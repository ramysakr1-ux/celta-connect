"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
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
  const admin = await requireRole("admin");

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
  await requireRole("admin");

  const templateId = formData.get("template_id");
  const sectionsRaw = formData.get("sections");
  if (typeof templateId !== "string" || typeof sectionsRaw !== "string") {
    return { error: "Something went wrong. Refresh and try again." };
  }

  let sections: TemplateSection[];
  try {
    sections = JSON.parse(sectionsRaw);
  } catch {
    return { error: "Could not parse the sections. Try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("assignment_templates").update({ sections }).eq("id", templateId);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath(`/dashboard/admin/assignment-briefs/${templateId}`);
  return { error: null };
}

export async function publishAssignmentTemplate(formData: FormData): Promise<void> {
  await requireRole("admin");
  const templateId = formData.get("template_id");
  if (typeof templateId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("assignment_templates")
    .update({ published_at: new Date().toISOString() })
    .eq("id", templateId);

  revalidatePath(`/dashboard/admin/assignment-briefs/${templateId}`);
  revalidatePath("/dashboard/admin/assignment-briefs");
}

export async function unpublishAssignmentTemplate(formData: FormData): Promise<void> {
  await requireRole("admin");
  const templateId = formData.get("template_id");
  if (typeof templateId !== "string") return;

  const supabase = await createClient();
  await supabase.from("assignment_templates").update({ published_at: null }).eq("id", templateId);

  revalidatePath(`/dashboard/admin/assignment-briefs/${templateId}`);
  revalidatePath("/dashboard/admin/assignment-briefs");
}
