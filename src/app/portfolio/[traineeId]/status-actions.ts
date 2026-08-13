"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";

export interface WithdrawFormState {
  error: string | null;
}

// specs/build-spec.md §3 "Withdrawal" -- formal and final, no reversal.
// Reportability is computed once, right now, from whether the course's
// entry_form_sent_at is already set -- not re-derived later, since setting
// that field afterward must never retroactively rewrite this candidate's
// history.
export async function withdrawTrainee(
  _prevState: WithdrawFormState,
  formData: FormData
): Promise<WithdrawFormState> {
  const staff = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const note = ((formData.get("note") as string | null) ?? "").trim() || null;
  if (typeof traineeId !== "string") {
    return { error: "Missing candidate." };
  }

  const supabase = await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, course_id, role, course_status")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee || trainee.role !== "trainee" || trainee.course_id !== staff.course_id) {
    return { error: "Candidate not found on your course." };
  }
  if (trainee.course_status !== "active") {
    return { error: "This candidate already has a course status set." };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("entry_form_sent_at")
    .eq("id", trainee.course_id as string)
    .maybeSingle();

  const now = new Date().toISOString();
  // profiles RLS only lets a user update their own row (or an admin update
  // anyone in their center) -- a trainer withdrawing someone else's row
  // needs the admin client, same as removeRosterMember. Authorization is
  // already independently checked above (role + same course), so this
  // isn't bypassing anything, just reaching past a policy that has no
  // "trainer, but only this one field, on someone else's row" carve-out.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      course_status: "withdrawn",
      course_status_set_at: now,
      course_status_set_by: staff.id,
      course_status_note: note,
      withdrawal_reportable: Boolean(course?.entry_form_sent_at),
      withdrawal_letter_generated_at: now,
    })
    .eq("id", traineeId);
  if (error) {
    return { error: "Could not withdraw this candidate. Try again." };
  }

  revalidatePath(`/portfolio/${traineeId}`);
  revalidatePath("/trainer/roster");
  return { error: null };
}

export interface ExtensionFormState {
  error: string | null;
}

// specs/build-spec.md §3 "Extension -- for special consideration... The
// candidate completes after the official end date... Close-out waits."
// Unlike withdrawTrainee, this does NOT freeze the portfolio -- course_status
// changes but isCourseStatusReadOnly deliberately excludes 'extension'.
export async function grantExtension(
  _prevState: ExtensionFormState,
  formData: FormData
): Promise<ExtensionFormState> {
  const staff = await requireRole(["trainer", "admin"]);
  const traineeId = formData.get("trainee_id");
  const note = ((formData.get("note") as string | null) ?? "").trim() || null;
  const completesBy = (formData.get("completes_by") as string | null) || null;
  if (typeof traineeId !== "string") {
    return { error: "Missing candidate." };
  }

  const supabase = await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, course_id, role, course_status")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee || trainee.role !== "trainee" || trainee.course_id !== staff.course_id) {
    return { error: "Candidate not found on your course." };
  }
  if (trainee.course_status !== "active") {
    return { error: "This candidate already has a course status set." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      course_status: "extension",
      course_status_set_at: new Date().toISOString(),
      course_status_set_by: staff.id,
      course_status_note: note,
      extension_completes_by: completesBy,
    })
    .eq("id", traineeId);
  if (error) {
    return { error: "Could not record the extension. Try again." };
  }

  revalidatePath(`/portfolio/${traineeId}`);
  revalidatePath("/trainer/roster");
  return { error: null };
}
