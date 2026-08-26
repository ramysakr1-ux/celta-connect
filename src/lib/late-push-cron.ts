import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwners } from "@/lib/push/send";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import type { AssignmentTypeValue } from "@/lib/assignment-templates/content";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// "Overdue" depends on each course's own centre -- a single daily sweep can
// span centres in different timezones, so there's no single "today" to
// filter a query by up front. getCachedCenter is itself cached, so calling
// this repeatedly for the same handful of courses across the three sweeps
// below is cheap.
async function todayForCourseId(admin: SupabaseClient<Database>, courseId: string): Promise<string> {
  const { data: course } = await admin.from("courses").select("center_id").eq("id", courseId).maybeSingle();
  const center = course ? await getCachedCenter(course.center_id) : null;
  return toLocalIso(new Date(), center?.time_zone ?? DEFAULT_TIMEZONE);
}

// twenty-decisions.md / build-spec.md: "only three [push kinds] ever leave
// the app -- a cancellation, a room change, or something already late."
// Confirmed with Ramy 2026-08-20: "late is past deadline for everybody,
// trainees and trainers alike" -- and, per the same day's follow-up,
// "everything that has a deadline on the timetable or set by the MCT,
// regardless of the role they are playing." Three triggers, one daily
// sweep (migration 0178) -- all date-level facts, not minute-level ones.
//
// connect-spec-corrections-for-claude-code.md item 4: "URGENT:" prefix
// only once the deadline has actually passed, never on the original
// due-date reminder -- every push this cron sends already meets that bar
// by construction (it only ever fires after the fact), so all three get it.
export async function runLatePushCron(): Promise<{
  firstSubmissionsPushed: number;
  resubmissionsPushed: number;
  trainersPushed: number;
}> {
  const admin = createAdminClient();

  let firstSubmissionsPushed = 0;
  let resubmissionsPushed = 0;
  let trainersPushed = 0;

  // First-submission deadline -- same definition src/lib/at-risk.ts already
  // uses, reused rather than inventing a second rule for the same fact.
  const { data: dueFirst } = await admin
    .from("assignments")
    .select("id, course_id, trainee_id, assignment_type, due_date")
    .eq("first_status", "not_submitted")
    .is("first_submitted_at", null)
    .is("first_late_push_sent_at", null)
    .not("due_date", "is", null);
  const overdueFirst = [];
  for (const a of dueFirst ?? []) {
    if (a.due_date! < (await todayForCourseId(admin, a.course_id))) overdueFirst.push(a);
  }

  for (const assignment of overdueFirst) {
    const title = ASSIGNMENT_INFO[assignment.assignment_type]?.title ?? assignment.assignment_type;
    const { sent } = await sendPushToOwners(
      { profileIds: [assignment.trainee_id] },
      {
        title: `URGENT: ${title} is now overdue`,
        body: "It hasn't been submitted and the deadline has passed.",
        url: `/portfolio/${assignment.trainee_id}/assignments`,
      }
    );
    await admin.from("assignments").update({ first_late_push_sent_at: new Date().toISOString() }).eq("id", assignment.id);
    if (sent > 0) firstSubmissionsPushed += 1;
  }

  // Resubmission deadline -- the due date lives on a course_timetable_events
  // row (type='resubmission_due'), not a column on assignments, so this is
  // resolved the same way course-progress.ts's own "at risk" computation
  // reads it: the event's date, for an assignment that actually owes one.
  const { data: dueResubmissionEvents } = await admin
    .from("course_timetable_events")
    .select("course_id, linked_assignment_type, event_date")
    .eq("type", "resubmission_due")
    .not("linked_assignment_type", "is", null);
  const overdueResubmissionEvents = [];
  for (const e of dueResubmissionEvents ?? []) {
    if (e.event_date < (await todayForCourseId(admin, e.course_id))) overdueResubmissionEvents.push(e);
  }

  for (const event of overdueResubmissionEvents) {
    if (!event.linked_assignment_type) continue;
    const assignmentType = event.linked_assignment_type as AssignmentTypeValue;
    const { data: owing } = await admin
      .from("assignments")
      .select("id, trainee_id, assignment_type")
      .eq("course_id", event.course_id)
      .eq("assignment_type", assignmentType)
      .eq("first_status", "resubmission_required")
      .eq("resubmission_status", "not_submitted")
      .is("resubmission_late_push_sent_at", null);

    for (const assignment of owing ?? []) {
      const title = ASSIGNMENT_INFO[assignment.assignment_type]?.title ?? assignment.assignment_type;
      const { sent } = await sendPushToOwners(
        { profileIds: [assignment.trainee_id] },
        {
          title: `URGENT: ${title} resubmission is now overdue`,
          body: "It hasn't been resubmitted and the deadline has passed.",
          url: `/portfolio/${assignment.trainee_id}/assignments`,
        }
      );
      await admin.from("assignments").update({ resubmission_late_push_sent_at: new Date().toISOString() }).eq("id", assignment.id);
      if (sent > 0) resubmissionsPushed += 1;
    }
  }

  // Trainer side -- the MCT's provisional_grades_due_at (migration 0127)
  // has passed while any trainee on the course still has no
  // provisional_grade recorded. One push per course, not per trainee.
  const { data: dueCourses } = await admin
    .from("courses")
    .select("id, name, center_id, provisional_grades_due_at")
    .not("provisional_grades_due_at", "is", null)
    .is("provisional_grades_late_push_sent_at", null);
  const overdueCourses = [];
  for (const c of dueCourses ?? []) {
    const center = await getCachedCenter(c.center_id);
    if (c.provisional_grades_due_at! < toLocalIso(new Date(), center?.time_zone ?? DEFAULT_TIMEZONE)) overdueCourses.push(c);
  }

  for (const course of overdueCourses) {
    const { data: trainees } = await admin.from("profiles").select("id").eq("course_id", course.id).eq("role", "trainee");
    const traineeIds = (trainees ?? []).map((t) => t.id);
    if (traineeIds.length === 0) continue;

    const { data: records } = await admin
      .from("celta5_records")
      .select("trainee_id, provisional_grade")
      .in("trainee_id", traineeIds);
    const hasGrade = new Set((records ?? []).filter((r) => r.provisional_grade !== null).map((r) => r.trainee_id));
    const stillMissing = traineeIds.some((id) => !hasGrade.has(id));
    if (!stillMissing) continue;

    const { data: mct } = await admin
      .from("course_tutors")
      .select("profile_id")
      .eq("course_id", course.id)
      .eq("tutor_role", "main_course_tutor")
      .is("left_at", null)
      .maybeSingle();

    // Marked sent either way -- a course with no MCT on record has nobody
    // to push to, and re-checking it every day forever wouldn't change that.
    await admin.from("courses").update({ provisional_grades_late_push_sent_at: new Date().toISOString() }).eq("id", course.id);
    if (!mct) continue;

    const { sent } = await sendPushToOwners(
      { profileIds: [mct.profile_id] },
      { title: "URGENT: Provisional grades are overdue", body: `${course.name} -- enter them in Appian when you can.`, url: "/trainer/grades-report" }
    );
    if (sent > 0) trainersPushed += 1;
  }

  return { firstSubmissionsPushed, resubmissionsPushed, trainersPushed };
}
