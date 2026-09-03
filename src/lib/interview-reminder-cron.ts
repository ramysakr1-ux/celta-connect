import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicantEmail, interviewReminderEmailHtml } from "@/lib/admissions-email";
import { interviewInstant, interviewWhen } from "@/lib/interview-time";

// Ramy, 3 Sep 2026: "be good to send them a one hour reminder before the
// interview." Volunteers had three reminder crons; interviews had none.
//
// A 55-65 minute window on a 5-minute sweep, so every booking falls inside it
// at least once, and interview_slots.reminder_sent_at stops the overlap from
// sending twice. Migration 0265's trigger clears that stamp whenever a slot
// is freed, so a rescheduled or rebooked interview is reminded again.
const WINDOW_START_MINUTES = 55;
const WINDOW_END_MINUTES = 65;

export async function runInterviewReminderCron(): Promise<{ slotsChecked: number; reminded: number }> {
  const admin = createAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_START_MINUTES * 60_000);
  const windowEnd = new Date(now.getTime() + WINDOW_END_MINUTES * 60_000);

  // Whether a slot is an hour away depends on its own centre's timezone, and
  // that is not known until the centre is resolved below -- so the query
  // narrows by a generous timezone-agnostic +/-1 day bound and the precise
  // filter happens in code. Same approach as the volunteer sweeps.
  const wideStart = new Date(windowStart.getTime() - 24 * 60 * 60 * 1000);
  const wideEnd = new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000);

  const { data: slots } = await admin
    .from("interview_slots")
    .select("id, center_id, intake_course_id, slot_date, slot_time, mode, booked_applicant_id, interviewer_id")
    .not("booked_applicant_id", "is", null)
    .is("reminder_sent_at", null)
    .gte("slot_date", wideStart.toISOString().slice(0, 10))
    .lte("slot_date", wideEnd.toISOString().slice(0, 10));

  const slotsChecked = slots?.length ?? 0;
  if (!slots || slots.length === 0) return { slotsChecked, reminded: 0 };

  const centerIds = [...new Set(slots.map((s) => s.center_id))];
  const applicantIds = slots.map((s) => s.booked_applicant_id).filter((id): id is string => typeof id === "string");
  const courseIds = [...new Set(slots.map((s) => s.intake_course_id))];

  const interviewerIds = [...new Set(slots.map((s) => s.interviewer_id).filter(Boolean))];

  const [{ data: centers }, { data: applicants }, { data: courses }, { data: interviewers }] = await Promise.all([
    admin.from("centers").select("id, name, admissions_email, time_zone").in("id", centerIds),
    admin.from("applicants").select("id, full_name, email, time_zone, stage, interview_invite_token").in("id", applicantIds),
    admin.from("courses").select("id, name").in("id", courseIds),
    // Ramy, 3 Sep 2026, asked for the interviewer to be reminded as well as
    // the applicant. Their own profile timezone is not tracked, so their
    // reminder is stated in the centre's zone -- which is where they work.
    interviewerIds.length > 0
      ? admin.from("profiles").select("id, full_name, email").in("id", interviewerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string | null }[] }),
  ]);
  const interviewerById = new Map((interviewers ?? []).map((i) => [i.id, i]));

  const centerById = new Map((centers ?? []).map((c) => [c.id, c]));
  const applicantById = new Map((applicants ?? []).map((a) => [a.id, a]));
  const courseById = new Map((courses ?? []).map((c) => [c.id, c]));

  let reminded = 0;

  for (const slot of slots) {
    const centre = centerById.get(slot.center_id);
    const instant = interviewInstant(
      { slotDate: slot.slot_date, slotTime: slot.slot_time },
      centre?.time_zone ?? null
    );
    if (instant < windowStart || instant >= windowEnd) continue;

    const applicant = slot.booked_applicant_id ? applicantById.get(slot.booked_applicant_id) : null;
    if (!applicant?.email) continue;

    // Someone whose interview already happened, or who withdrew or was
    // rejected between booking and now, should not be reminded to attend it.
    if (applicant.stage !== "interview_booked") continue;

    const when = interviewWhen({
      slot: { slotDate: slot.slot_date, slotTime: slot.slot_time },
      centreTimeZone: centre?.time_zone ?? null,
      applicantTimeZone: applicant.time_zone,
      centreName: centre?.name,
    });

    await sendApplicantEmail({
      centerName: centre?.name ?? "the centre",
      centerAdmissionsEmail: centre?.admissions_email ?? null,
      to: applicant.email,
      subject: "Your interview is in about an hour",
      centerId: slot.center_id,
      applicantId: applicant.id,
      type: "interview_reminder",
      recipientName: applicant.full_name,
      html: interviewReminderEmailHtml({
        applicantName: applicant.full_name,
        courseName: courseById.get(slot.intake_course_id)?.name ?? "the course",
        centerName: centre?.name ?? "the centre",
        when,
        mode: slot.mode,
        joinNote:
          slot.mode === "online"
            ? "The centre will send you the joining link if you do not already have it."
            : null,
      }),
    });

    // And the interviewer, in the centre's own zone. Their email failing must
    // not stop the applicant's reminder being marked sent, so it is separate
    // and swallowed: the applicant's is the one that matters.
    const interviewer = interviewerById.get(slot.interviewer_id);
    if (interviewer?.email) {
      try {
        await sendApplicantEmail({
          centerName: centre?.name ?? "the centre",
          centerAdmissionsEmail: centre?.admissions_email ?? null,
          to: interviewer.email,
          subject: `Interview in about an hour: ${applicant.full_name}`,
          centerId: slot.center_id,
          applicantId: applicant.id,
          type: "interview_reminder",
          recipientName: interviewer.full_name,
          html: interviewReminderEmailHtml({
            applicantName: interviewer.full_name,
            courseName: courseById.get(slot.intake_course_id)?.name ?? "the course",
            centerName: centre?.name ?? "the centre",
            // Staff read a rota, so theirs is stated in the centre's zone,
            // with the applicant's own zone noted after it.
            when: interviewWhen({
              slot: { slotDate: slot.slot_date, slotTime: slot.slot_time },
              centreTimeZone: centre?.time_zone ?? null,
              applicantTimeZone: null,
              centreName: centre?.name,
            }),
            mode: slot.mode,
            joinNote: `You are interviewing ${applicant.full_name}.${
              applicant.time_zone ? ` Their local time zone is ${applicant.time_zone}.` : ""
            }`,
          }),
        });
      } catch {
        // See above.
      }
    }

    // Stamped after the send, so a failed send is retried on the next sweep
    // rather than silently swallowed -- there is only an hour to get it right.
    await admin.from("interview_slots").update({ reminder_sent_at: new Date().toISOString() }).eq("id", slot.id);
    reminded++;
  }

  return { slotsChecked, reminded };
}
