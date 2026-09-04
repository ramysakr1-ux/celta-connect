import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Who may open a course's Trainer-in-Training record.
//
// Ramy, 4 Sep 2026: "the trainee, their supervisor, anyone the MCT grants,
// and the assessor (view-only)". The database says the same thing in
// tit_can_access_course_tutor() (migration 0267); this is the read-only
// mirror the (hub) layout uses to decide whether the tab exists at all,
// and the TinT page uses to pick which records to show. Uses the admin
// client because an assessor session has no auth.uid() for RLS to key on.

export interface TitRowLite {
  id: string;
  profile_id: string;
  supervisor_profile_id: string | null;
  verified_at: string | null;
  course_id: string;
}

export interface TitViewer {
  id: string;
  role: string;
  isMct: boolean;
}

/** Every live trainer-in-training row on the course, and which of them this viewer may see. */
export async function trainerInTrainingAccess(input: {
  courseId: string | null;
  profile: TitViewer | null;
  assessorTour: boolean;
}): Promise<{ all: TitRowLite[]; visible: TitRowLite[]; grantedIds: Set<string> }> {
  const none = { all: [], visible: [], grantedIds: new Set<string>() };
  if (!input.courseId) return none;
  const admin = createAdminClient();
  const { data } = await admin
    .from("course_tutors")
    .select("id, profile_id, supervisor_profile_id, verified_at, course_id")
    .eq("course_id", input.courseId)
    .eq("is_trainer_in_training", true)
    .is("left_at", null);
  const all = (data ?? []) as TitRowLite[];
  if (all.length === 0) return none;

  if (!input.profile) {
    // An assessor on the tour sees everything, read-only; anyone else without
    // a profile sees nothing.
    return input.assessorTour ? { all, visible: all, grantedIds: new Set() } : none;
  }
  const p = input.profile;
  if (p.role === "admin" || p.role === "platform_owner" || p.isMct) return { all, visible: all, grantedIds: new Set() };

  const { data: grants } = await admin
    .from("tit_access_grants")
    .select("course_tutors_id")
    .in("course_tutors_id", all.map((t) => t.id))
    .eq("grantee_profile_id", p.id)
    .is("revoked_at", null);
  const grantedIds = new Set((grants ?? []).map((g) => g.course_tutors_id));
  const visible = all.filter((t) => t.profile_id === p.id || t.supervisor_profile_id === p.id || grantedIds.has(t.id));
  return { all, visible, grantedIds };
}

export async function canSeeTrainerInTraining(input: { courseId: string | null; profile: TitViewer | null; assessorTour: boolean }): Promise<boolean> {
  const { visible } = await trainerInTrainingAccess(input);
  return visible.length > 0;
}
