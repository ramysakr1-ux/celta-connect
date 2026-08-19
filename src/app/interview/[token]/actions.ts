"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { esc } from "@/lib/email-layout";

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
      admin.from("applicants").select("full_name, intake_course_id").eq("id", input.applicantId).maybeSingle(),
      admin.from("centers").select("name, admissions_email").eq("id", input.centerId).maybeSingle(),
    ]);
    if (!slot || !applicant || !center) return;

    const { getAreaHolders } = await import("@/lib/auth/area-holders");
    const holders = await getAreaHolders(input.centerId);
    const admissionsHolderId = holders.get("admissions")?.profileId ?? null;
    const ids = [slot.interviewer_id, admissionsHolderId].filter((id): id is string => typeof id === "string" && id.length > 0);
    if (!ids.length) return;

    const { data: people } = await admin.from("profiles").select("full_name, email").in("id", [...new Set(ids)]);
    if (!people?.length) return;

    const when = `${new Date(`${slot.slot_date}T${slot.slot_time}`).toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
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
