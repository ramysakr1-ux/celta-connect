import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Records who changed what in a centre's management.
 *
 * Ramy, 31 Aug 2026: "if only one person is doing the job, then obviously
 * that's it. But if more than one person [is] sharing the same job... then it
 * should have the same treatment as the centre owner. It should leave a
 * digital footprint."
 *
 * Logged unconditionally, not only where several people hold the role. The
 * cost is identical, a single-admin centre gets it for free, and a centre that
 * adds a second admin next month would otherwise have a hole in its history at
 * exactly the point it starts to matter.
 *
 * Writes through the service-role client because the log must record actions
 * the actor could not otherwise write, and because there is deliberately no
 * insert policy: a log its subject can edit is not a log.
 *
 * Never throws. A failure to log must not fail the action the user asked for
 * -- an unlogged tutor change is bad, a tutor change that appears to fail
 * while having half-happened is worse. Failures are surfaced to the server
 * console rather than swallowed silently.
 */
export async function logManagementAction(entry: {
  centerId: string;
  actorId: string;
  /** Stable machine key, e.g. "tutor.role_changed". */
  action: string;
  /** Set for course-level actions; omit for centre-level ones. */
  courseId?: string | null;
  targetTable?: string | null;
  targetId?: string | null;
  /** Prior state in the interface's own words. Omit when nothing existed before. */
  previousValue?: string | null;
  /** New state, in the same words. */
  newValue?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await createAdminClient()
      .from("centre_owner_actions")
      .insert({
        center_id: entry.centerId,
        actor_profile_id: entry.actorId,
        action: entry.action,
        course_id: entry.courseId ?? null,
        target_table: entry.targetTable ?? null,
        target_id: entry.targetId ?? null,
        previous_value: entry.previousValue ?? null,
        new_value: entry.newValue ?? null,
        detail: entry.detail ?? {},
      } as never);
  } catch (e) {
    console.error("[activity-log] failed to record", entry.action, e);
  }
}

/**
 * The interface's own words for a tutor role, so the log reads the way the
 * screen does. A log that says "main_course_tutor" makes the reader translate;
 * the reader here is an assessor or an owner months later, not a developer.
 */
export const TUTOR_ROLE_LABELS: Record<string, string> = {
  main_course_tutor: "Main course tutor",
  assistant_course_tutor: "Assistant course tutor",
  teaching_practice_tutor: "Teaching practice tutor",
  input_session_tutor: "Input session tutor",
  external_assessor: "Assessor",
};

export const tutorRoleLabel = (role: string | null | undefined): string | null =>
  role ? (TUTOR_ROLE_LABELS[role] ?? role) : null;
