"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export interface FormState {
  error: string | null;
}

// Centre-level identity -- name + the real Cambridge-assigned centre
// number. Every course under this centre shares the same number (it's
// not a per-course value), so it lives here rather than on the
// create-course form -- that form just shows it read-only for
// confirmation. Previously had no edit UI at all: centers.center_number
// only ever held an auto-generated "PENDING-xxxxxxxx" placeholder
// (migration 0003) until an admin actually sets the real one here.
export async function updateCenterProfile(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireRole("admin");

  const name = (formData.get("name") as string | null)?.trim();
  const centerNumber = (formData.get("center_number") as string | null)?.trim();
  const isUkCentre = formData.get("is_uk_centre") === "on";
  if (!name || !centerNumber) {
    return { error: "Enter both the centre name and centre number." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("centers")
    .update({ name, center_number: centerNumber, is_uk_centre: isUkCentre })
    .eq("id", profile.center_id);

  if (error) {
    return {
      error: error.code === "23505" ? "That centre number is already in use." : "Could not save. Try again.",
    };
  }

  revalidatePath("/dashboard/admin/settings");
  revalidatePath("/dashboard/admin");
  return { error: null };
}

// project_grading_feedback_trainer_awareness.md §2 -- "on by default,
// disable-able in settings". Plain checkbox toggle, no confirm state
// needed (unlike name/number, there's nothing to validate).
export async function updateAutoTagCriteria(formData: FormData): Promise<void> {
  const profile = await requireRole("admin");
  const enabled = formData.get("auto_tag_criteria_enabled") === "on";

  const admin = createAdminClient();
  await admin.from("centers").update({ auto_tag_criteria_enabled: enabled }).eq("id", profile.center_id);

  revalidatePath("/dashboard/admin/settings");
}

export async function updateGoogleDriveTargets(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireRole("admin");

  const templateDocId = (formData.get("template_doc_id") as string) || null;
  const outputFolderId = (formData.get("output_folder_id") as string) || null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("center_google_connections")
    .update({ template_doc_id: templateDocId, output_folder_id: outputFolderId })
    .eq("center_id", profile.center_id);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/dashboard/admin/settings");
  return { error: null };
}

export async function disconnectGoogleDrive(): Promise<void> {
  const profile = await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("center_google_connections").delete().eq("center_id", profile.center_id);
  revalidatePath("/dashboard/admin/settings");
}

export async function addStyleExample(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireRole("admin");

  const tone = formData.get("tone");
  const exampleText = (formData.get("example_text") as string | null)?.trim();
  if (tone !== "direct" && tone !== "supportive") {
    return { error: "Invalid tone." };
  }
  if (!exampleText) {
    return { error: "Enter an example." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("feedback_style_examples").insert({
    center_id: profile.center_id,
    tone,
    example_text: exampleText,
    created_by: profile.id,
  });

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/dashboard/admin/settings");
  return { error: null };
}

export async function updateStyleExample(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireRole("admin");

  const id = formData.get("id") as string | null;
  const exampleText = (formData.get("example_text") as string | null)?.trim();
  if (!id || !exampleText) {
    return { error: "Enter an example." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("feedback_style_examples")
    .update({ example_text: exampleText })
    .eq("id", id)
    .eq("center_id", profile.center_id);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/dashboard/admin/settings");
  return { error: null };
}

const TUTOR_ROLES = [
  "main_course_tutor",
  "assistant_course_tutor",
  "teaching_practice_tutor",
  "input_session_tutor",
  "external_assessor",
] as const;

// Edits an existing course_tutors row -- role, trainer-in-training status
// (0051's own check constraint enforces verified_at is set before this can
// be true), and per-course online-experience evidence (Handbook: every
// tutor on an online/mixed course must be able to evidence online
// teaching/training experience). Does NOT add a tutor to an ADDITIONAL
// course -- 0051's own comment flags that as needing a real decision about
// what happens to their access to their old course (profiles.course_id is
// still the single source RLS reads for "which course is this login
// scoped to" today), not something to guess at here.
export async function updateCourseTutor(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireRole("admin");

  const id = formData.get("id") as string | null;
  const tutorRole = formData.get("tutor_role") as string | null;
  const isTraineeInTraining = formData.get("is_trainer_in_training") === "on";
  const verifiedAt = (formData.get("verified_at") as string | null) || null;
  const supervisorProfileId = (formData.get("supervisor_profile_id") as string | null) || null;
  const onlineExperienceEvidenced = formData.get("online_experience_evidenced") === "on";
  const onlineExperienceNote = (formData.get("online_experience_note") as string | null)?.trim() || null;

  if (!id) return { error: "Missing tutor record." };
  if (tutorRole && !TUTOR_ROLES.includes(tutorRole as (typeof TUTOR_ROLES)[number])) {
    return { error: "Invalid tutor role." };
  }
  if (isTraineeInTraining && !verifiedAt) {
    return { error: "A trainer-in-training needs a Cambridge verification date on file first." };
  }

  const admin = createAdminClient();

  const { data: row } = await admin.from("course_tutors").select("id, course_id").eq("id", id).maybeSingle();
  if (!row) return { error: "Tutor record not found." };
  const { data: course } = await admin.from("courses").select("center_id").eq("id", row.course_id).maybeSingle();
  if (!course || course.center_id !== profile.center_id) {
    return { error: "Tutor record not found." };
  }

  const { error } = await admin
    .from("course_tutors")
    .update({
      tutor_role: (tutorRole || null) as (typeof TUTOR_ROLES)[number] | null,
      is_trainer_in_training: isTraineeInTraining,
      verified_at: verifiedAt,
      supervisor_profile_id: supervisorProfileId,
      online_experience_evidenced: onlineExperienceEvidenced,
      online_experience_note: onlineExperienceNote,
    })
    .eq("id", id);

  if (error) {
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/dashboard/admin/settings");
  return { error: null };
}

export async function deleteStyleExample(formData: FormData): Promise<void> {
  const profile = await requireRole("admin");
  const id = formData.get("id") as string | null;
  if (!id) return;

  const admin = createAdminClient();
  await admin
    .from("feedback_style_examples")
    .delete()
    .eq("id", id)
    .eq("center_id", profile.center_id);
  revalidatePath("/dashboard/admin/settings");
}
