"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { isMctOfCourse } from "@/lib/course-tutor-role";

// Recording which candidates the centre puts to the assessor for observation.
//
// Advisory throughout. This never writes profiles.selected_for_assessor_visit
// and never narrows what the assessor's own page shows: Administration
// Handbook 15.1 gives the selection to the assessor "in consultation with the
// centre", so the centre proposes and the assessor decides. What is recorded
// here is the centre's half of that conversation, with a name and a date on
// it.
//
// Append-only (migration 0279). A changed mind is a new row, never an update,
// so the visit keeps its history -- the same standard as
// platform_owner_access_log, and for the same reason: more than one person can
// act on a course's assessor arrangements.

export interface ObservationChoiceResult {
  error: string | null;
  /** Set once a write has actually landed, so the form can close itself. */
  ok?: boolean;
}

export async function recordObservationChoice(
  _prev: ObservationChoiceResult,
  formData: FormData
): Promise<ObservationChoiceResult> {
  const trainer = await requireRole(["trainer", "admin"]);
  const courseId = trainer.course_id;
  if (!courseId) return { error: "No course assigned." };

  // The assessor visit is the main course tutor's to run, so the tab is
  // MCT-only and so is this. isMctOfCourse reads course_tutors -- the live
  // source the tab itself gates on -- not profiles.tutor_role, which is set
  // once at signup and never re-synced.
  if (!(await isMctOfCourse(trainer, courseId))) {
    return { error: "Only the main course tutor can set this." };
  }

  const source = formData.get("source") === "centre" ? "centre" : "connect";
  const traineeIds = formData.getAll("trainee_id").filter((v): v is string => typeof v === "string");
  const recommendedIds = formData.getAll("recommended_id").filter((v): v is string => typeof v === "string");
  const reasonRaw = formData.get("reason");
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";

  if (traineeIds.length === 0) return { error: "Choose at least one candidate." };
  // 14.2 asks for two, but a course can legitimately have only one candidate
  // teaching on the visit day -- so the ceiling is enforced and the floor is
  // not. The database agrees (0279's cardinality check).
  if (traineeIds.length > 2) return { error: "The Handbook asks for two candidates, not more." };
  if (source === "centre" && reason.length < 3) {
    return { error: "Say why you are choosing different candidates — it goes on the record with your name." };
  }

  const supabase = await createClient();

  // Everyone named must actually be a candidate on this course. The form is
  // built from the visit day's teaching list, so a mismatch means the page
  // was stale or the ids were edited.
  const { data: named } = await supabase.from("profiles").select("id").eq("course_id", courseId).eq("role", "trainee").in("id", traineeIds);
  if ((named ?? []).length !== traineeIds.length) {
    return { error: "One of those candidates is not on this course any more. Reload and try again." };
  }

  const { error } = await supabase.from("assessor_observation_choices").insert({
    course_id: courseId,
    trainee_ids: traineeIds,
    source,
    reason: source === "centre" ? reason : null,
    recommended_ids: recommendedIds,
    chosen_by: trainer.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/trainer/assessor");
  return { error: null, ok: true };
}
