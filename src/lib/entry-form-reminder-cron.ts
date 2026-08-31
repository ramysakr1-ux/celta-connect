import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwners } from "@/lib/push/send";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { computeEntryFormDeadline } from "@/lib/entry-form-deadline";
import { can, type OverrideMatrix } from "@/lib/auth/centre-permissions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Chases the Cambridge entry form before its deadline goes by unnoticed.
 *
 * Ramy, 31 Aug 2026: "overdue two weeks before the course starts. Okay. Good.
 * A reminder. Does it push anywhere?" It did not -- the deadline turned a card
 * red on one page and did nothing else, so if nobody opened that page the
 * deadline passed in silence.
 *
 * Cadence is the whole design here. A daily push for as long as the form stays
 * unsent is how people learn to ignore notifications, and an ignored
 * notification is worse than none because it also buys false comfort. So:
 * three days before the deadline, once on the day it passes, then weekly.
 * Three is far enough out to act on and near enough to feel real.
 */
const WARN_DAYS_BEFORE = 3;
const REPEAT_DAYS_WHEN_OVERDUE = 7;

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/**
 * Who is chased. Everyone whose effective capability lets them run course
 * admin at that centre, plus the course's own tutors -- the MCT can set this
 * date too, and on a small course they may be the only person who will.
 *
 * Read through the capability matrix rather than profiles.role, the same way
 * admissions notifications are, so that a centre owner who moves this
 * responsibility to a custom role moves the reminder with it.
 */
async function recipientsFor(
  admin: SupabaseClient<Database>,
  centerId: string,
  courseId: string
): Promise<string[]> {
  const [{ data: roleRows }, { data: overrideRows }, { data: tutors }] = await Promise.all([
    admin.from("centre_roles").select("profile_id, role").eq("center_id", centerId).is("revoked_at", null),
    admin.from("centre_permission_overrides").select("role_key, capability_key, granted_level").eq("center_id", centerId),
    admin.from("course_tutors").select("profile_id").eq("course_id", courseId).is("left_at", null),
  ]);

  const overrides: OverrideMatrix = {};
  for (const row of overrideRows ?? []) {
    overrides[row.role_key] = overrides[row.role_key] ?? {};
    overrides[row.role_key][row.capability_key] = row.granted_level;
  }

  const ids = new Set<string>();
  for (const row of roleRows ?? []) {
    if (can([row.role], "courseAdmin.invite", overrides)) ids.add(row.profile_id);
  }
  for (const t of tutors ?? []) ids.add(t.profile_id);
  return [...ids];
}

export async function runEntryFormReminderCron(): Promise<{ coursesChecked: number; reminded: number }> {
  const admin = createAdminClient();

  // Only courses that have not sent it and have not already finished. A course
  // that started without the form still needs chasing -- arguably more so.
  const { data: courses } = await admin
    .from("courses")
    .select("id, name, center_id, start_date, end_date, delivery_mode, entry_form_sent_at, entry_form_reminder_sent_at")
    .is("entry_form_sent_at", null);

  const { data: centres } = await admin.from("centers").select("id, time_zone");
  const tzById = new Map((centres ?? []).map((c) => [c.id, c.time_zone ?? DEFAULT_TIMEZONE]));

  let reminded = 0;
  for (const course of courses ?? []) {
    if (!course.start_date || !course.end_date) continue;

    const today = toLocalIso(new Date(), tzById.get(course.center_id) ?? DEFAULT_TIMEZONE);
    if (today > course.end_date) continue; // finished; chasing it helps nobody now

    const deadline = computeEntryFormDeadline(course.start_date, course.delivery_mode);
    const daysLeft = daysBetween(today, deadline);
    if (daysLeft > WARN_DAYS_BEFORE) continue;

    const lastSent = course.entry_form_reminder_sent_at
      ? toLocalIso(new Date(course.entry_form_reminder_sent_at), tzById.get(course.center_id) ?? DEFAULT_TIMEZONE)
      : null;
    const daysSinceLast = lastSent ? daysBetween(lastSent, today) : Infinity;

    // Before the deadline: one warning, and only one. After it: repeat, but
    // weekly rather than daily.
    const due = daysLeft >= 0 ? lastSent === null : daysSinceLast >= REPEAT_DAYS_WHEN_OVERDUE || lastSent === null;
    if (!due) continue;

    const recipients = await recipientsFor(admin, course.center_id, course.id);
    if (recipients.length === 0) continue;

    const overdueBy = -daysLeft;
    await sendPushToOwners(
      { profileIds: recipients },
      {
        // "URGENT:" only once the date has actually passed -- the same rule
        // late-push-cron follows, so the word keeps its meaning.
        title: daysLeft >= 0 ? `${course.name}: entry form due` : `URGENT: ${course.name} entry form overdue`,
        body:
          daysLeft >= 0
            ? `The Cambridge entry form is due in ${daysLeft === 0 ? "today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}. Submit it in Appian, then mark it sent.`
            : `The Cambridge entry form was due ${overdueBy} day${overdueBy === 1 ? "" : "s"} ago and has not been marked sent.`,
        url: `/dashboard/admin/courses/${course.id}`,
      }
    );

    await admin
      .from("courses")
      .update({ entry_form_reminder_sent_at: new Date().toISOString() } as never)
      .eq("id", course.id);
    reminded += 1;
  }

  return { coursesChecked: (courses ?? []).length, reminded };
}
