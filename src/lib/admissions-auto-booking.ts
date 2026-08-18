import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicantEmail, interviewAutoBookedEmailHtml } from "@/lib/admissions-email";

// specs/for-claude-code-email-inventory.md Part 1: "clear on every
// criterion -> invitation drafted, held 15 minutes, then auto-sent with
// interview times." admissions-ai-triage.ts sets interview_auto_send_at
// (now + 15 minutes) the moment a "clear" reading lands on a centre with
// autobook on; this is the sweep that actually fires once that time has
// passed, unless a human clicked Hold in the meantime.
//
// Runs from the same once-a-day admissions cron route rather than its own
// schedule -- see src/app/api/cron/admissions-waiting-list/route.ts's own
// comment: the Vercel Hobby plan this project is on caps cron jobs at
// 2/day, both already spoken for. This means the 15-minute hold is a floor,
// not a target -- an invitation clear at 9am and not cancelled sits until
// the next day's run, not 15 minutes later. Genuinely worth a tighter
// schedule (a paid Vercel plan, or a Supabase pg_cron job running inside
// the database itself, independent of Vercel's cron limits) if a centre
// turns autobook on and finds the delay matters in practice -- flagged
// rather than assumed, since either is a real infra decision.
export async function runAdmissionsAutoBookCron(): Promise<{ booked: number; skipped: number }> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await admin
    .from("applicants")
    .select("id, center_id, intake_course_id, full_name, email")
    .eq("ai_reading_lane", "clear")
    .not("interview_auto_send_at", "is", null)
    .lte("interview_auto_send_at", nowIso)
    .is("interview_auto_send_cancelled_at", null)
    .is("interview_auto_send_sent_at", null);

  let booked = 0;
  let skipped = 0;

  for (const applicant of due ?? []) {
    const ok = await autoBookEarliestSlot(admin, applicant);
    if (ok) booked++;
    else skipped++;
  }

  return { booked, skipped };
}

async function autoBookEarliestSlot(
  admin: ReturnType<typeof createAdminClient>,
  applicant: { id: string; center_id: string; intake_course_id: string; full_name: string; email: string }
): Promise<boolean> {
  const nowIso = new Date().toISOString();

  // Earliest still-open slot for this intake -- "the app gives it to
  // whoever has interviewed least this intake" (Interview Booking.dc.html),
  // read across every date/time still open rather than one staff-chosen
  // time_key, since nobody is picking a time here.
  const { data: openSlots } = await admin
    .from("interview_slots")
    .select("id, interviewer_id, slot_date, slot_time, mode")
    .eq("center_id", applicant.center_id)
    .eq("intake_course_id", applicant.intake_course_id)
    .is("booked_applicant_id", null)
    .gte("slot_date", nowIso.slice(0, 10))
    .order("slot_date", { ascending: true })
    .order("slot_time", { ascending: true });

  if (!openSlots || openSlots.length === 0) {
    // Nothing to book into. Left pending rather than marked sent -- a
    // later regeneration of slots lets the next cron run pick it up,
    // and it still shows as awaiting-booking on the admissions screen
    // via ai_reading_lane = 'clear' with no interview_auto_send_sent_at.
    return false;
  }

  const earliestKey = `${openSlots[0].slot_date}::${openSlots[0].slot_time}`;
  const earliestCandidates = openSlots.filter((s) => `${s.slot_date}::${s.slot_time}` === earliestKey);

  const interviewerIds = [...new Set(earliestCandidates.map((c) => c.interviewer_id))];
  const { data: bookedCounts } = await admin
    .from("interview_slots")
    .select("interviewer_id")
    .eq("intake_course_id", applicant.intake_course_id)
    .in("interviewer_id", interviewerIds)
    .not("booked_applicant_id", "is", null);
  const countByInterviewer = new Map<string, number>();
  for (const id of interviewerIds) countByInterviewer.set(id, 0);
  for (const row of bookedCounts ?? []) {
    countByInterviewer.set(row.interviewer_id, (countByInterviewer.get(row.interviewer_id) ?? 0) + 1);
  }
  const chosen = earliestCandidates
    .slice()
    .sort((a, b) => (countByInterviewer.get(a.interviewer_id) ?? 0) - (countByInterviewer.get(b.interviewer_id) ?? 0))[0];

  const { data: updatedSlot } = await admin
    .from("interview_slots")
    .update({ booked_applicant_id: applicant.id })
    .eq("id", chosen.id)
    .is("booked_applicant_id", null)
    .select("id")
    .maybeSingle();
  if (!updatedSlot) return false; // Raced by a staff booking between the read and here.

  await admin
    .from("applicants")
    .update({ stage: "interview_booked", interview_auto_send_sent_at: new Date().toISOString() })
    .eq("id", applicant.id);

  const when = `${new Date(`${chosen.slot_date}T${chosen.slot_time}`).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })} (${chosen.mode === "online" ? "online" : "in person"})`;

  const { data: center } = await admin.from("centers").select("name, admissions_email").eq("id", applicant.center_id).maybeSingle();
  if (center && applicant.email) {
    await sendApplicantEmail({
      centerName: center.name,
      centerAdmissionsEmail: center.admissions_email,
      to: applicant.email,
      subject: "we would like to meet you",
      centerId: applicant.center_id,
      applicantId: applicant.id,
      type: "interview_invitation",
      html: interviewAutoBookedEmailHtml({ applicantName: applicant.full_name, when }),
    });
  }

  await notifyStaffOfAutoBooking(admin, { applicantId: applicant.id, slotId: chosen.id, centerId: applicant.center_id });

  return true;
}

// Staff-side echo of the booking, same idea as bookInterviewSlot's own
// notifyInterviewBooked in dashboard/admissions/actions.ts -- kept as its
// own small copy here rather than importing a "use server" actions module
// into a cron lib, and because this one has no human "who just clicked
// book" to skip notifying.
async function notifyStaffOfAutoBooking(
  admin: ReturnType<typeof createAdminClient>,
  input: { applicantId: string; slotId: string; centerId: string }
) {
  try {
    const { data: slot } = await admin
      .from("interview_slots")
      .select("slot_date, slot_time, mode, interviewer_id")
      .eq("id", input.slotId)
      .maybeSingle();
    const { data: applicant } = await admin.from("applicants").select("full_name").eq("id", input.applicantId).maybeSingle();
    const { data: center } = await admin.from("centers").select("name, admissions_email").eq("id", input.centerId).maybeSingle();
    if (!slot || !applicant || !center) return;

    const { data: interviewer } = await admin.from("profiles").select("full_name, email").eq("id", slot.interviewer_id).maybeSingle();
    if (!interviewer?.email) return;

    const when = `${new Date(`${slot.slot_date}T${slot.slot_time}`).toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    })} (${slot.mode === "online" ? "online" : "in person"})`;

    await sendApplicantEmail({
      centerName: center.name,
      centerAdmissionsEmail: center.admissions_email,
      to: interviewer.email,
      subject: "an interview has been booked automatically",
      centerId: input.centerId,
      applicantId: input.applicantId,
      type: "interview_booked",
      recipientName: interviewer.full_name,
      html: `<p>${applicant.full_name}'s written task read as clear on every criterion, so the interview was booked automatically: ${when}.</p>`,
    });
  } catch {
    // A notification failure must not undo a booking that already happened.
  }
}
