"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { upsertAssignmentTemplateRecord } from "@/lib/assignment-templates/upload";
import { publishBriefVersion } from "@/lib/assignment-brief";
import type { AssignmentTypeValue, TemplateSection } from "@/lib/assignment-templates/content";

export interface FormState {
  error: string | null;
}

export async function trainerUploadAssignmentBrief(input: {
  assignmentType: AssignmentTypeValue;
  storagePath: string;
  originalFilename: string;
}): Promise<{ error: string | null }> {
  const trainer = await requireRole("trainer");

  const result = await upsertAssignmentTemplateRecord({
    centerId: trainer.center_id,
    uploadedBy: trainer.id,
    ...input,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  redirect(`/trainer/assignment-briefs/${result.id}`);
}

export async function updateAssignmentTemplateSections(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const trainer = await requireRole("trainer");

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
  // A brief is VERSIONED, not overwritten. Editing sections changes their
  // keys, and assignment_section_responses is keyed by section_key -- so
  // before migration 0300 an edit silently orphaned every answer and every
  // tutor comment already written against the old keys. Submitted work now
  // keeps the version it answered; drafts are carried across so nothing the
  // candidate typed is lost. See src/lib/assignment-brief.ts.
  const { data: template } = await supabase
    .from("assignment_templates")
    .select("center_id, assignment_type")
    .eq("id", templateId)
    .maybeSingle();
  if (!template) return { error: "That brief no longer exists." };

  const published = await publishBriefVersion(supabase, {
    templateId,
    centerId: template.center_id,
    assignmentType: template.assignment_type,
    sections,
    format,
    publishedBy: trainer.id,
  });
  const error = published.error ? { message: published.error } : null;

  if (error) {
    // The message below is what the person reads; this is what we read.
    console.error("[trainer/(hub)/assignment-briefs:updateAssignmentTemplateSections]", error);
    return { error: "Could not save. Try again." };
}

  revalidatePath(`/trainer/assignment-briefs/${templateId}`);
  return { error: null };
}

// Administration Handbook June 2025 9.2.1: "At least two of the assignments
// should be written in continuous prose." Course Admin's copy of this action
// has refused a non-compliant set since the rule was built; the trainer hub's
// copy -- the door tutors actually use -- had no check at all, so the same
// centre could publish four structured briefs through one screen and not the
// other. Two doors onto one area enforce one rule (13 Sep 2026).
export async function publishAssignmentTemplate(formData: FormData): Promise<void> {
  const trainer = await requireRole("trainer");
  const templateId = formData.get("template_id");
  if (typeof templateId !== "string") return;

  const supabase = await createClient();
  const { data: allTemplates } = await supabase
    .from("assignment_templates")
    .select("id, format, published_at")
    .eq("center_id", trainer.center_id)
    .neq("assignment_type", "Plagiarism Reflection");

  const afterPublish = (allTemplates ?? []).map((t) =>
    t.id === templateId ? { ...t, published_at: new Date().toISOString() } : t
  );
  // Only judged once the full set of four is published -- a half-built centre
  // is not in breach of anything yet.
  if (afterPublish.length === 4 && afterPublish.every((t) => t.published_at)) {
    if (afterPublish.filter((t) => t.format === "prose").length < 2) {
      redirect(`/trainer/assignment-briefs/${templateId}?publish_error=format_count`);
    }
  }

  await supabase
    .from("assignment_templates")
    .update({ published_at: new Date().toISOString() })
    .eq("id", templateId);

  revalidatePath(`/trainer/assignment-briefs/${templateId}`);
  revalidatePath("/trainer/assignment-briefs");
}

export async function unpublishAssignmentTemplate(formData: FormData): Promise<void> {
  await requireRole("trainer");
  const templateId = formData.get("template_id");
  if (typeof templateId !== "string") return;

  const supabase = await createClient();
  await supabase.from("assignment_templates").update({ published_at: null }).eq("id", templateId);

  revalidatePath(`/trainer/assignment-briefs/${templateId}`);
  revalidatePath("/trainer/assignment-briefs");
}
