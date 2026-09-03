"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { esc } from "@/lib/email-layout";
import { interviewWhen, interviewInstant } from "@/lib/interview-time";
import { getAdmissionsHandlerProfileIds } from "@/lib/admissions-notify";
import { sendInterviewConfirmationToApplicant } from "@/lib/interview-confirmation";

export interface ClaimSlotState {
  error: string | null;
}

// "First click wins -- a slot is reserved and removed from availability
// the instant someone takes it... build reservation as atomic (claim-on-
// click) with a live/re-fetched slot list, so two applicants can't
// double-book the same slot." The `.is("booked_applicant_id", null)`
// guard on the update is what makes it atomic -- a second click loses the
// race and gets told to pick another time, same idiom as
// dashboard/admissions/actions.ts bookInterviewSlot's own time_key path,
// which this mirrors (least-loaded interviewer at the chosen time), just
// token-authenticated instead of staff-authenticated.
export async function claimInterviewSlot(_prevState: ClaimSlotState, formData: FormData): Promise<ClaimSlotState> {
  const token = formData.get("token");
  const timeKey = formData.get("time_key");
  if (typeof token !== "string" || typeof timeKey !== "string" || !token || !timeKey) {
    return { error: "Something went wrong. Refresh and try again." };
  }
  const [slotDate, slotTime] = timeKey.split("::");
  if (!slotDate || !slotTime) return { error: "Something went wrong. Refresh and try again." };

  const admin = createAdminClient();
  const { data: applicant } = await admin
    .from("applicants")
    .select("id, center_id, intake_course_id, stage")
    .eq("interview_invite_token", token)
    .maybeSingle();
  if (!applicant) return { error: "This link is invalid." };
  if (applicant.stage === "interview_booked") return { error: "You've already booked a time." };

  const { data: candidates } = await admin
    .from("interview_slots")
    .select("id, interviewer_id")
    .eq("center_id", applicant.center_id)
    .eq("intake_course_id", applicant.intake_course_id)
    .eq("slot_date", slotDate)
    .eq("slot_time", slotTime)
    .is("booked_applicant_id", null);
  if (!candidates || candidates.length === 0) {
    return { error: "That time was just taken -- pick another below." };
  }

  const interviewerIds = [...new Set(candidates.map((c) => c.interviewer_id))];
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
  const leastLoaded = candidates
    .slice()
    .sort((a, b) => (countByInterviewer.get(a.interviewer_id) ?? 0) - (countByInterviewer.get(b.interviewer_id) ?? 0))[0];

  const { data: claimed } = await admin
    .from("interview_slots")
    .update({ booked_applicant_id: applicant.id })
    .eq("id", leastLoaded.id)
    .is("booked_applicant_id", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { error: "That time was just taken -- pick another below." };

  await admin.from("applicants").update({ stage: "interview_booked" }).eq("id", applicant.id);

  await sendInterviewConfirmationToApplicant(admin, {
    applicantId: applicant.id,
    slotId: leastLoaded.id,
    centerId: applicant.center_id,
  });
  await notifyStaffOfPickerBooking(admin, { applicantId: applicant.id, slotId: leastLoaded.id, centerId: applicant.center_id });

  revalidatePath(`/interview/${token}`);
  return { error: null };
}

// Staff-side echo, same pattern as dashboard/admissions/actions.ts's own
// notifyInterviewBooked -- kept as a local copy rather than importing a
// "use server" actions module from here, and because there is no staff
// member who "just clicked book" to skip notifying (the applicant did).
async function notifyStaffOfPickerBooking(
  admin: ReturnType<typeof createAdminClient>,
  input: { applicantId: string; slotId: string; centerId: string }
) {
  try {
    const [{ data: slot }, { data: applicant }, { data: center }] = await Promise.all([
      admin.from("interview_slots").select("slot_date, slot_time, mode, interviewer_id").eq("id", input.slotId).maybeSingle(),
      admin.from("applicants").select("full_name, intake_course_id, time_zone").eq("id", input.applicantId).maybeSingle(),
      admin.from("centers").select("name, admissions_email, time_zone").eq("id", input.centerId).maybeSingle(),
    ]);
    if (!slot || !applicant || !center) return;

    const { getAreaHolders } = await import("@/lib/auth/area-holders");
    const holders = await getAreaHolders(input.centerId);
    const admissionsHolderId = holders.get("admissions")?.profileId ?? null;
    const ids = [slot.interviewer_id, admissionsHolderId].filter((id): id is string => typeof id === "string" && id.length > 0);
    if (!ids.length) return;

    const { data: people } = await admin.from("profiles").select("full_name, email").in("id", [...new Set(ids)]);
    if (!people?.length) return;

    // Both zones, centre first for staff -- they are reading a rota. Was a
    // bare toLocaleString with no timeZone option, so it printed in whatever
    // zone the server ran in and named none.
    const when = `${interviewWhen({
      slot: { slotDate: slot.slot_date, slotTime: slot.slot_time },
      centreTimeZone: center.time_zone,
      applicantTimeZone: applicant.time_zone,
      centreName: center.name,
    })} (${slot.mode === "online" ? "online" : "in person"})`;

    const { sendApplicantEmail } = await import("@/lib/admissions-email");
    for (const person of people) {
      if (!person.email) continue;
      await sendApplicantEmail({
        centerName: center.name,
        centerAdmissionsEmail: center.admissions_email,
        to: person.email,
        subject: "an interview has been booked",
        centerId: input.centerId,
        applicantId: input.applicantId,
        type: "interview_booked",
        recipientName: person.full_name,
        html: `<p>${esc(applicant.full_name)} booked themselves in for ${esc(when)}.</p>`,
      });
    }
  } catch {
    // A notification failure must not undo a booking that already happened.
  }
}

// Rescheduling, once, by the applicant themselves.
//
// Ramy, 3 Sep 2026, asked whether there was a rescheduling option. There was
// not: the only way a booked slot got freed was a staff member clearing it by
// hand, so an applicant whose circumstances changed had to email and wait. He
// chose self-service, one change only, with a cutoff.
//
// Three guards, all re-checked here rather than trusted from the page that
// rendered the button:
//   - they must actually be booked
//   - they must not have moved it before (applicants.interview_rescheduled_at)
//   - it must not be inside the cutoff below
//
// This does NOT rebook them. It frees the slot and returns them to the
// picker, so the same claim-on-click race protection applies to their new
// choice as to their first one -- and the slot they gave up is immediately
// available to somebody else.
const RESCHEDULE_CUTOFF_HOURS = 24;

export interface RescheduleState {
  error: string | null;
}

export async function rescheduleInterview(_prevState: RescheduleState, formData: FormData): Promise<RescheduleState> {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) return { error: "Something went wrong. Refresh and try again." };

  const admin = createAdminClient();
  const { data: applicant } = await admin
    .from("applicants")
    .select("id, full_name, center_id, intake_course_id, stage, time_zone, interview_rescheduled_at")
    .eq("interview_invite_token", token)
    .maybeSingle();

  if (!applicant) return { error: "This link is invalid." };
  if (applicant.stage !== "interview_booked") return { error: "You don't have an interview booked to move." };
  if (applicant.interview_rescheduled_at) {
    return { error: "You've already moved your interview once. Please contact the centre if you need to change it again." };
  }

  const { data: slot } = await admin
    .from("interview_slots")
    .select("id, slot_date, slot_time, mode")
    .eq("booked_applicant_id", applicant.id)
    .maybeSingle();
  if (!slot) return { error: "We couldn't find your booking. Please contact the centre." };

  const { data: center } = await admin
    .from("centers")
    .select("name, admissions_email, time_zone")
    .eq("id", applicant.center_id)
    .maybeSingle();

  const startsAt = interviewInstant({ slotDate: slot.slot_date, slotTime: slot.slot_time }, center?.time_zone ?? null);
  const hoursAway = (startsAt.getTime() - Date.now()) / 3_600_000;
  if (hoursAway < RESCHEDULE_CUTOFF_HOURS) {
    return {
      error: `Your interview is less than ${RESCHEDULE_CUTOFF_HOURS} hours away, so it can't be moved here. Please contact the centre.`,
    };
  }

  const previousWhen = interviewWhen({
    slot: { slotDate: slot.slot_date, slotTime: slot.slot_time },
    centreTimeZone: center?.time_zone ?? null,
    applicantTimeZone: applicant.time_zone,
    centreName: center?.name,
  });

  // Free the slot first. If the stage update below failed after this, they
  // would be un-booked and able to pick again -- recoverable. The other order
  // would leave them stage-shifted with their old slot still held, which
  // blocks somebody else from taking it.
  const { error: freeError } = await admin
    .from("interview_slots")
    .update({ booked_applicant_id: null })
    .eq("id", slot.id)
    .eq("booked_applicant_id", applicant.id);
  if (freeError) return { error: "Could not release your slot. Please try again." };

  // Back to the stage the picker serves from, and the stamp that spends
  // their one change.
  await admin
    .from("applicants")
    .update({ stage: "task_returned", interview_rescheduled_at: new Date().toISOString() })
    .eq("id", applicant.id);

  await notifyStaffOfReschedule({
    centerId: applicant.center_id,
    applicantId: applicant.id,
    applicantName: applicant.full_name,
    intakeCourseId: applicant.intake_course_id,
    previousWhen,
    centerName: center?.name ?? "the centre",
    centerAdmissionsEmail: center?.admissions_email ?? null,
  });

  revalidatePath(`/interview/${token}`);
  return { error: null };
}

async function notifyStaffOfReschedule(input: {
  centerId: string;
  applicantId: string;
  applicantName: string;
  intakeCourseId: string;
  previousWhen: string;
  centerName: string;
  centerAdmissionsEmail: string | null;
}): Promise<void> {
  // A notification failure must never undo a reschedule that already happened
  // -- same rule as the booking notifications above it.
  try {
    const admin = createAdminClient();
    const { data: course } = await admin.from("courses").select("name").eq("id", input.intakeCourseId).maybeSingle();
    const profileIds = await getAdmissionsHandlerProfileIds(admin, input.centerId);
    if (profileIds.length === 0) return;

    const { data: people } = await admin.from("profiles").select("full_name, email").in("id", profileIds);
    if (!people?.length) return;

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.celtaconnect.com";
    const { sendApplicantEmail, interviewRescheduledEmailHtml } = await import("@/lib/admissions-email");

    for (const person of people) {
      if (!person.email) continue;
      await sendApplicantEmail({
        centerName: input.centerName,
        centerAdmissionsEmail: input.centerAdmissionsEmail,
        to: person.email,
        subject: "An applicant moved their interview",
        centerId: input.centerId,
        applicantId: input.applicantId,
        type: "interview_rescheduled",
        recipientName: person.full_name,
        html: interviewRescheduledEmailHtml({
          recipientName: person.full_name,
          applicantName: input.applicantName,
          courseName: course?.name ?? "the course",
          previousWhen: input.previousWhen,
          reviewUrl: `${base}/dashboard/admissions/${input.applicantId}`,
        }),
      });
    }
  } catch {
    // Deliberately swallowed, as above.
  }
}
