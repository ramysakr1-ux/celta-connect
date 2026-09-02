"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/require-capability";
import { createClient } from "@/lib/supabase/server";
import { upsertAssignmentTemplateRecord } from "@/lib/assignment-templates/upload";
import type { AssignmentTypeValue, TemplateSection } from "@/lib/assignment-templates/content";

export interface FormState {
  error: string | null;
}

export async function adminUploadAssignmentBrief(input: {
  assignmentType: AssignmentTypeValue;
  storagePath: string;
  originalFilename: string;
}): Promise<{ error: string | null }> {
  const admin = await requireCapability("courseAdmin.settings");

  const result = await upsertAssignmentTemplateRecord({
    centerId: admin.center_id,
    uploadedBy: admin.id,
    ...input,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  redirect(`/dashboard/admin/assignment-briefs/${result.id}`);
}

export async function updateAssignmentTemplateSections(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireCapability("courseAdmin.settings");

  const templateId = formData.get("template_id");
  const sectionsRaw = formData.get("sections");
  const format = formData.get("format");
  if (
    typeof templateId !== "string" ||
    typeof sectionsRaw !== "string" ||
    (format !== "prose" && format !== "structured")
  ) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  let sections: TemplateSection[];
  try {
    sections = JSON.parse(sectionsRaw);
  } catch {
    return { error: "Could not parse the sections. Try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("assignment_templates").update({ sections, format }).eq("id", templateId);

  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[dashboard/admin/assignment-briefs:updateAssignmentTemplateSections]", error);
    return { error: "Could not save. Try again." };
}

  revalidatePath(`/dashboard/admin/assignment-briefs/${templateId}`);
  return { error: null };
}

// remaining-compliance.md item 1: exactly two of the centre's four briefs
// must be academic prose (Syllabus, assessment requirements). Warned
// non-blockingly on the edit page at any point, but refused here -- only
// at the moment publishing this one would complete a full set of 4
// published briefs with the wrong prose count. Can't judge "wrong count"
// before all 4 exist and are published, so earlier publishes never trip
// this even if the running count looks off mid-setup.
export async function publishAssignmentTemplate(formData: FormData): Promise<void> {
  const admin = await requireCapability("courseAdmin.settings");
  const templateId = formData.get("template_id");
  if (typeof templateId !== "string") return;

  const supabase = await createClient();
  const { data: allTemplates } = await supabase
    .from("assignment_templates")
    .select("id, format, published_at")
    .eq("center_id", admin.center_id);

  const afterPublish = (allTemplates ?? []).map((t) =>
    t.id === templateId ? { ...t, published_at: new Date().toISOString() } : t
  );
  const completingFullPublishedSet = afterPublish.length === 4 && afterPublish.every((t) => t.published_at);
  if (completingFullPublishedSet) {
    const proseCount = afterPublish.filter((t) => t.format === "prose").length;
    if (proseCount !== 2) {
      redirect(`/dashboard/admin/assignment-briefs/${templateId}?publish_error=format_count`);
    }
  }

  await supabase
    .from("assignment_templates")
    .update({ published_at: new Date().toISOString() })
    .eq("id", templateId);

  revalidatePath(`/dashboard/admin/assignment-briefs/${templateId}`);
  revalidatePath("/dashboard/admin/assignment-briefs");
}

export async function unpublishAssignmentTemplate(formData: FormData): Promise<void> {
  await requireCapability("courseAdmin.settings");
  const templateId = formData.get("template_id");
  if (typeof templateId !== "string") return;

  const supabase = await createClient();
  await supabase.from("assignment_templates").update({ published_at: null }).eq("id", templateId);

  revalidatePath(`/dashboard/admin/assignment-briefs/${templateId}`);
  revalidatePath("/dashboard/admin/assignment-briefs");
}
