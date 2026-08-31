import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendPushToOwners } from "@/lib/push/send";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { computeCourseState } from "@/lib/course-progress";

/**
 * Whether a course is mid-flight right now, in the CENTRE's timezone.
 *
 * Thin wrapper over computeCourseState() rather than a second implementation
 * of the same comparison -- I wrote one before finding it, which is exactly
 * how two subtly different answers to "is it running" end up in one codebase.
 * The timezone matters: a course starting today in Istanbul has not started at
 * 22:00 UTC the evening before, and being right about "already started" is the
 * whole point of the check.
 */
export function isCourseRunning(
  course: { start_date: string | null; end_date: string | null },
  timeZone: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!course.start_date || !course.end_date) return false;
  const today = toLocalIso(now, timeZone ?? DEFAULT_TIMEZONE);
  return computeCourseState(course.start_date, course.end_date, today) === "running";
}

/**
 * Tells the people teaching a course that its composition changed under them.
 *
 * Ramy, 31 Aug 2026: "serious changes to a course that already started and is
 * running should also be somewhat guarded or flagged. Maybe people on the
 * course should know -- maybe the MCT... should be notified. There should be
 * a warning in case someone does change something by accident."
 *
 * Two separate defences, and this is the second. The first is the confirmation
 * in front of the control, which stops the accident. This one catches the case
 * where the accident happened anyway, or where the change was deliberate but
 * the people it lands on were not in the room -- an MCT who is teaching should
 * not discover on Monday that they are no longer the MCT.
 *
 * The actor is excluded: they know, they just did it. Notification failures
 * never fail the change itself -- sendPushToOwners already swallows its own
 * errors for exactly that reason.
 */
export async function notifyCourseTutorsOfChange(
  admin: SupabaseClient<Database>,
  input: { courseId: string; actorId: string; title: string; body: string }
): Promise<void> {
  const { data: tutors } = await admin
    .from("course_tutors")
    .select("profile_id")
    .eq("course_id", input.courseId)
    .is("left_at", null);

  const profileIds = [...new Set((tutors ?? []).map((t) => t.profile_id))].filter((id) => id !== input.actorId);
  if (profileIds.length === 0) return;

  await sendPushToOwners(
    { profileIds },
    {
      title: input.title,
      body: input.body,
      url: `/dashboard/admin/courses/${input.courseId}`,
    }
  );
}
