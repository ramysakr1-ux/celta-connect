import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Ramy, 2026-08-18: "every interview invite sends the same picker link
// into the centre's open interview_slots pool... the applicant always
// picks their own time, nothing is auto-booked on their behalf." Slots
// are grouped by (date, time) the same way the staff-side booking picker
// already groups them (dashboard/admissions/actions.ts bookInterviewSlot)
// -- an applicant sees one bookable time, not a named interviewer, and
// the server resolves which interviewer (least-loaded) at claim time.

export interface PickerTimeOption {
  timeKey: string; // `${slot_date}::${slot_time}`
  slotDate: string;
  slotTime: string;
  mode: "online" | "face_to_face";
  durationMinutes: number;
  // "Taken and past slots stay visible, greyed out and marked 'Booked'
  // rather than disappearing" -- both cases collapse to the same
  // not-bookable state and the same label, deliberately, per spec.
  bookable: boolean;
}

export async function getPickerTimeOptions(
  admin: SupabaseClient<Database>,
  input: { centerId: string; intakeCourseId: string }
): Promise<PickerTimeOption[]> {
  const { data: slots } = await admin
    .from("interview_slots")
    .select("slot_date, slot_time, mode, duration_minutes, booked_applicant_id")
    .eq("center_id", input.centerId)
    .eq("intake_course_id", input.intakeCourseId)
    .order("slot_date", { ascending: true })
    .order("slot_time", { ascending: true });

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const nowTime = nowIso.slice(11, 16);

  const byKey = new Map<
    string,
    { slotDate: string; slotTime: string; mode: "online" | "face_to_face"; durationMinutes: number; open: number }
  >();
  for (const s of slots ?? []) {
    const key = `${s.slot_date}::${s.slot_time}`;
    const existing = byKey.get(key);
    const isOpen = !s.booked_applicant_id;
    if (existing) {
      if (isOpen) existing.open += 1;
    } else {
      byKey.set(key, { slotDate: s.slot_date, slotTime: s.slot_time, mode: s.mode, durationMinutes: s.duration_minutes, open: isOpen ? 1 : 0 });
    }
  }

  return [...byKey.entries()]
    .map(([timeKey, v]) => {
      const isPast = v.slotDate < today || (v.slotDate === today && v.slotTime < nowTime);
      return {
        timeKey,
        slotDate: v.slotDate,
        slotTime: v.slotTime,
        mode: v.mode,
        durationMinutes: v.durationMinutes,
        bookable: !isPast && v.open > 0,
      };
    })
    .sort((a, b) => (a.timeKey < b.timeKey ? -1 : 1));
}

export function hasBookableOption(options: PickerTimeOption[]): boolean {
  return options.some((o) => o.bookable);
}

// "If every slot the applicant could see becomes unavailable (taken or
// past), don't invent a new one -- show an honest 'we're finding you a
// time' state and create an admissions task, same as the existing no-
// slots-available case." Called both when an invite goes out with
// nothing to offer, and again if the applicant later revisits the picker
// and finds it empty (slots can be taken by someone else after the
// invite was sent). Idempotent -- one open flag per applicant, not one
// per visit.
export async function flagNoInterviewSlots(
  admin: SupabaseClient<Database>,
  input: { applicantId: string; centerId: string; applicantName: string }
) {
  const { data: existing } = await admin
    .from("admissions_notifications")
    .select("id")
    .eq("applicant_id", input.applicantId)
    .eq("type", "no_interview_slots")
    .is("read_at", null)
    .maybeSingle();
  if (existing) return;

  await admin.from("admissions_notifications").insert({
    center_id: input.centerId,
    applicant_id: input.applicantId,
    type: "no_interview_slots",
    message: `${input.applicantName} has no interview slots open yet -- add some.`,
  });
  {
    const { notifyAdmissionsHandlers } = await import("@/lib/admissions-notify");
    const { noInterviewSlotsEmailHtml } = await import("@/lib/admissions-email");
    const reviewUrl = `${process.env.SITE_URL ?? "https://celtaconnect.com"}/dashboard/admissions/this-week`;
    await notifyAdmissionsHandlers(admin, {
      centerId: input.centerId,
      applicantId: input.applicantId,
      emailType: "no_interview_slots",
      subject: `No interview slots -- ${input.applicantName}`,
      pushBody: `${input.applicantName} has no interview slots open yet -- add some.`,
      pushUrl: reviewUrl,
      buildEmailHtml: (recipientName) => noInterviewSlotsEmailHtml({ recipientName, applicantName: input.applicantName, reviewUrl }),
    }).catch(() => null);
  }
}
