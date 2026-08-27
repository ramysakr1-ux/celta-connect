import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendApplicantEmail,
  startsMondayEmailHtml,
  lateEnrolmentEmailHtml,
  accountNotSetUpEmailHtml,
} from "@/lib/admissions-email";
import { resolveGtkyAssignments } from "@/lib/gtky-assignment";

// specs/handoffs/Course Emails.dc.html: "Welcome goes out the Friday
// before and carries the link to their day-one activity, because that is
// the first moment levels and groups exist. A late enrolment gets the
// same welcome with its expectations lowered." The other two course
// emails (Acceptance/Offer, Workspace ready/"welcome") already have real
// send paths; this was the one piece still missing one.
//
// Checked daily from admissions-cron.ts's existing route rather than a
// new schedule. One pass per course covers both cases without two
// separate trigger mechanisms:
//   - today is the Friday immediately before start_date -> the normal,
//     on-time send
//   - today is after that Friday but before start_date (a place freed up
//     late, or someone paid late) -> the late-enrolment send, still
//     inside the "before day one" window the design insists on
// Idempotent via applicant_emails (checked per applicant, not a new
// column) so a candidate who already got either version is never
// double-emailed by a later run of the same sweep.
const LEVEL_BAND_LABEL: Record<string, string> = {
  a1: "beginner",
  elem: "elementary",
  pre: "pre-intermediate",
  inter: "intermediate",
  upper: "upper-intermediate",
};

// Exported for the pre-course task's answer-key unlock (for-claude-code-
// pre-course-task-screens.md: "opens to the whole cohort on the Friday
// date... nobody is gated on anyone else finishing first") -- same Friday
// this file's own cron already anchors the welcome email to, not a second
// date to keep in sync.
export function mostRecentFridayBefore(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00`);
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() !== 5);
  return d.toISOString().slice(0, 10);
}

export async function runStartsMondayCron(): Promise<{ sent: number }> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: courses } = await admin
    .from("courses")
    .select("id, center_id, name, start_date, delivery_mode")
    .gte("start_date", today)
    .lte("start_date", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

  let sent = 0;
  for (const course of courses ?? []) {
    const fridayBefore = mostRecentFridayBefore(course.start_date);
    if (today < fridayBefore) continue; // not yet the Friday before -- nothing to do

    const isLate = today > fridayBefore;

    // Ramy, 27 Aug 2026: "a trainer is not picking anything, it's all done
    // automatically" -- resolveGtkyAssignments is already idempotent per
    // trainee (skips anyone who already has a row) and already derives
    // level/group entirely from real data (TP1's coursebook, subgroup
    // pairing), so the only thing wrong was that a trainer had to click a
    // button to fire it. Same Friday window as everything else here.
    await resolveGtkyAssignments(admin, course.id);

    const { data: applicants } = await admin
      .from("applicants")
      .select("id, full_name, email, offer_token, resulting_trainee_id")
      .eq("intake_course_id", course.id)
      .not("workspace_released_at", "is", null);

    for (const applicant of applicants ?? []) {
      if (!applicant.email) continue;

      const { data: alreadySent } = await admin
        .from("applicant_emails")
        .select("id")
        .eq("applicant_id", applicant.id)
        .in("type", ["starts_monday", "late_enrolment"])
        .limit(1)
        .maybeSingle();
      if (alreadySent) continue;

      const { data: center } = await admin.from("centers").select("name, admissions_email").eq("id", course.center_id).maybeSingle();
      if (!center) continue;
      const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://celtaconnect.com";
      const startTime = "09:30"; // no per-course start-time field exists yet; matches the reference copy's own default
      const startDay = new Date(`${course.start_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

      const mctName = await resolveMctName(admin, course.id);

      if (!applicant.resulting_trainee_id) {
        await sendApplicantEmail({
          centerName: center.name,
          centerAdmissionsEmail: center.admissions_email,
          to: applicant.email,
          subject: `${course.name} starts ${startDay}`,
          centerId: course.center_id,
          applicantId: applicant.id,
          type: "starts_monday",
          html: accountNotSetUpEmailHtml({
            candidateName: applicant.full_name,
            courseName: course.name,
            startTime,
            startDay,
            setupUrl: `${base}/offer/${applicant.offer_token}`,
            directorName: mctName ?? "Your course tutor",
            directorRole: "Course Director",
          }),
        });
        sent++;
        continue;
      }

      const groupAndLevel = await resolveGroupAndLevel(admin, applicant.resulting_trainee_id);
      const tutorNames = await resolveCourseTutorNames(admin, course.id);
      const room = course.delivery_mode === "online" ? "online, via the link in Connect" : `at ${center.name}`;

      if (isLate) {
        await sendApplicantEmail({
          centerName: center.name,
          centerAdmissionsEmail: center.admissions_email,
          to: applicant.email,
          subject: `welcome to ${course.name} — starting ${startDay}, and what to ignore`,
          centerId: course.center_id,
          applicantId: applicant.id,
          type: "late_enrolment",
          html: lateEnrolmentEmailHtml({
            candidateName: applicant.full_name,
            courseName: course.name,
            daysNotice: daysNotice(today, course.start_date),
            startTime,
            startDay,
            room,
            groupName: groupAndLevel.groupName ?? "your group",
            levelName: groupAndLevel.levelName ?? "your",
            tutorNames: tutorNames ?? "your tutors",
            setupUrl: `${base}/offer/${applicant.offer_token}`,
            directorName: mctName ?? "Your course tutor",
            directorRole: "Course Director",
          }),
        });
      } else {
        await sendApplicantEmail({
          centerName: center.name,
          centerAdmissionsEmail: center.admissions_email,
          to: applicant.email,
          subject: `${course.name} starts ${startDay} — here is your group and your first activity`,
          centerId: course.center_id,
          applicantId: applicant.id,
          type: "starts_monday",
          html: startsMondayEmailHtml({
            candidateName: applicant.full_name,
            courseName: course.name,
            startTime,
            startDay,
            room,
            groupName: groupAndLevel.groupName ?? "your group",
            levelName: groupAndLevel.levelName ?? "your",
            tutorNames: tutorNames ?? "your tutors",
            activitiesUrl: `${base}/portfolio/${applicant.resulting_trainee_id}/gtky`,
            directorName: mctName ?? "Your course tutor",
            directorRole: "Course Director",
          }),
        });
      }
      sent++;
    }
  }

  return { sent };
}

function daysNotice(today: string, startDate: string): string {
  const days = Math.max(1, Math.round((new Date(`${startDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000));
  return days === 1 ? "one day" : `${days} days`;
}

async function resolveGroupAndLevel(
  admin: ReturnType<typeof createAdminClient>,
  traineeId: string
): Promise<{ groupName: string | null; levelName: string | null }> {
  const { data: membership } = await admin.from("course_subgroup_members").select("subgroup_id").eq("trainee_id", traineeId).maybeSingle();
  let groupName: string | null = null;
  if (membership) {
    const { data: subgroup } = await admin.from("course_subgroups").select("tp_group_id").eq("id", membership.subgroup_id).maybeSingle();
    if (subgroup?.tp_group_id) {
      const { data: tpGroup } = await admin.from("course_tp_groups").select("name").eq("id", subgroup.tp_group_id).maybeSingle();
      groupName = tpGroup?.name ?? null;
    }
  }

  const { data: tp1 } = await admin.from("plan_assignments").select("tp_point_id").eq("trainee_id", traineeId).eq("tp_number", 1).maybeSingle();
  let levelName: string | null = null;
  if (tp1?.tp_point_id) {
    const { data: tpPoint } = await admin.from("tp_points").select("tp_coursebook_id").eq("id", tp1.tp_point_id).maybeSingle();
    if (tpPoint?.tp_coursebook_id) {
      const { data: coursebook } = await admin.from("tp_coursebooks").select("level").eq("id", tpPoint.tp_coursebook_id).maybeSingle();
      if (coursebook?.level) {
        const band = coursebook.level.trim().toUpperCase();
        const { gtkyLevelBandFromCourseLevel } = await import("@/lib/gtky-activities");
        const mapped = gtkyLevelBandFromCourseLevel(band);
        levelName = mapped ? LEVEL_BAND_LABEL[mapped] : coursebook.level;
      }
    }
  }

  return { groupName, levelName };
}

async function resolveMctName(admin: ReturnType<typeof createAdminClient>, courseId: string): Promise<string | null> {
  const { data: mct } = await admin
    .from("course_tutors")
    .select("profiles(full_name)")
    .eq("course_id", courseId)
    .eq("tutor_role", "main_course_tutor")
    .maybeSingle();
  return (mct?.profiles as { full_name?: string } | null)?.full_name ?? null;
}

async function resolveCourseTutorNames(admin: ReturnType<typeof createAdminClient>, courseId: string): Promise<string | null> {
  const { data: tutors } = await admin
    .from("course_tutors")
    .select("profiles(full_name)")
    .eq("course_id", courseId)
    .in("tutor_role", ["main_course_tutor", "assistant_course_tutor"]);
  const names = (tutors ?? [])
    .map((t) => (t.profiles as { full_name?: string } | null)?.full_name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
