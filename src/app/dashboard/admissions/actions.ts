"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmissionsHandler, canDecideAdmissions } from "@/lib/admissions-access";
import { referApplicant } from "@/lib/admissions-referral";
import {
  sendApplicantEmail,
  acceptancePlaceEmailHtml,
  rejectionEmailHtml,
  rejectionAfterInterviewEmailHtml,
  waitingListEmailHtml,
} from "@/lib/admissions-email";
import { offerNextWaitingListPlace } from "@/lib/admissions-waiting-list";
import { regenerateSlotsForInterviewer } from "@/lib/interview-availability";
import type { Database } from "@/lib/supabase/types";

/** "You are second on the waiting list" -- the design spells the rank out. */
const ORDINAL_WORD: Record<number, string> = {
  1: "first",
  2: "second",
  3: "third",
  4: "fourth",
  5: "fifth",
  6: "sixth",
  7: "seventh",
  8: "eighth",
  9: "ninth",
  10: "tenth",
};

export interface FormState {
  error: string | null;
}

// ---- Centre settings: writing prompts + interview question bank ----

export async function addWritingPrompt(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const promptType = formData.get("prompt_type");
  const promptText = formData.get("prompt_text");
  if (
    typeof promptType !== "string" ||
    !["narrative", "descriptive", "argumentative"].includes(promptType) ||
    typeof promptText !== "string" ||
    !promptText.trim()
  ) {
    return;
  }
  const supabase = await createClient();
  await supabase.from("application_writing_prompts").insert({
    center_id: staff.center_id,
    prompt_type: promptType as "narrative" | "descriptive" | "argumentative",
    prompt_text: promptText.trim(),
  });
  revalidatePath("/dashboard/admissions/settings");
}

export async function togglePromptActive(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const promptId = formData.get("prompt_id");
  const active = formData.get("active") === "true";
  if (typeof promptId !== "string") return;
  const supabase = await createClient();
  await supabase.from("application_writing_prompts").update({ active: !active }).eq("id", promptId).eq("center_id", staff.center_id);
  revalidatePath("/dashboard/admissions/settings");
}

// design_handoff_pre_interview_speaking -- same shape as the writing
// prompts above, minus the fixed narrative/descriptive/argumentative type:
// the speaking task's prompts are all one kind (short, everyday, spoken).
export async function addSpeakingPrompt(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const promptText = formData.get("prompt_text");
  if (typeof promptText !== "string" || !promptText.trim()) return;
  const supabase = await createClient();
  await supabase.from("speaking_task_prompts").insert({ center_id: staff.center_id, prompt_text: promptText.trim() });
  revalidatePath("/dashboard/admissions/settings");
}

export async function toggleSpeakingPromptActive(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const promptId = formData.get("prompt_id");
  const active = formData.get("active") === "true";
  if (typeof promptId !== "string") return;
  const supabase = await createClient();
  await supabase.from("speaking_task_prompts").update({ active: !active }).eq("id", promptId).eq("center_id", staff.center_id);
  revalidatePath("/dashboard/admissions/settings");
}

const COVERAGE_AREAS = [
  "motivation_suitability",
  "language_awareness",
  "classroom_presence",
  "flexibility_openness",
  "digital_literacy",
  "time_commitment",
  "other",
] as const;

export async function addInterviewQuestion(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const questionText = formData.get("question_text");
  const coverageArea = formData.get("coverage_area");
  if (
    typeof questionText !== "string" ||
    !questionText.trim() ||
    typeof coverageArea !== "string" ||
    !COVERAGE_AREAS.includes(coverageArea as (typeof COVERAGE_AREAS)[number])
  ) {
    return;
  }
  const supabase = await createClient();
  await supabase.from("interview_questions").insert({
    center_id: staff.center_id,
    question_text: questionText.trim(),
    coverage_area: coverageArea as (typeof COVERAGE_AREAS)[number],
  });
  revalidatePath("/dashboard/admissions/settings");
}

export async function toggleQuestionActive(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const questionId = formData.get("question_id");
  const active = formData.get("active") === "true";
  if (typeof questionId !== "string") return;
  const supabase = await createClient();
  await supabase.from("interview_questions").update({ active: !active }).eq("id", questionId).eq("center_id", staff.center_id);
  revalidatePath("/dashboard/admissions/settings");
}

// ---- Interview slots ----

export async function createInterviewSlot(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const intakeCourseId = formData.get("intake_course_id");
  const slotDate = formData.get("slot_date");
  const slotTime = formData.get("slot_time");
  const mode = formData.get("mode");
  const panel = formData.get("panel") === "on";
  const secondInterviewerId = (formData.get("second_interviewer_id") as string | null) || null;

  if (
    typeof intakeCourseId !== "string" ||
    typeof slotDate !== "string" ||
    typeof slotTime !== "string" ||
    typeof mode !== "string" ||
    !["online", "face_to_face"].includes(mode) ||
    !intakeCourseId ||
    !slotDate ||
    !slotTime
  ) {
    return;
  }

  const supabase = await createClient();
  await supabase.from("interview_slots").insert({
    center_id: staff.center_id,
    intake_course_id: intakeCourseId,
    interviewer_id: staff.id,
    panel,
    second_interviewer_id: panel ? secondInterviewerId : null,
    slot_date: slotDate,
    slot_time: slotTime,
    mode: mode as "online" | "face_to_face",
    created_by: staff.id,
  });
  revalidatePath("/dashboard/admissions");
}

// Interview Availability.dc.html: "the applicant sees one time, not two
// names. The app gives it to whoever has interviewed least this intake,
// and an administrator can override to a named interviewer." Two paths
// into the same action: `slot_id` books that exact row (the override --
// staff named a specific interviewer), `time_key` books a time and lets
// the server resolve which of the interviewers free at that moment has
// the fewest bookings on this intake so far.
export async function bookInterviewSlot(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  const slotIdOverride = (formData.get("slot_id") as string | null) || null;
  const timeKey = (formData.get("time_key") as string | null) || null;
  if (typeof applicantId !== "string" || (!slotIdOverride && !timeKey)) return;

  const supabase = await createClient();
  let slotId = slotIdOverride;

  if (!slotId && timeKey) {
    const [intakeCourseId, slotDate, slotTime] = timeKey.split("::");
    if (!intakeCourseId || !slotDate || !slotTime) return;

    const { data: candidates } = await supabase
      .from("interview_slots")
      .select("id, interviewer_id")
      .eq("center_id", staff.center_id)
      .eq("intake_course_id", intakeCourseId)
      .eq("slot_date", slotDate)
      .eq("slot_time", slotTime)
      .is("booked_applicant_id", null);
    if (!candidates || candidates.length === 0) return;

    const interviewerIds = [...new Set(candidates.map((c) => c.interviewer_id))];
    const { data: bookedCounts } = await supabase
      .from("interview_slots")
      .select("interviewer_id")
      .eq("intake_course_id", intakeCourseId)
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
    slotId = leastLoaded.id;
  }
  if (!slotId) return;

  const { data: slot } = await supabase.from("interview_slots").select("id, center_id, booked_applicant_id").eq("id", slotId).maybeSingle();
  if (!slot || slot.center_id !== staff.center_id || slot.booked_applicant_id) return;

  await supabase.from("interview_slots").update({ booked_applicant_id: applicantId }).eq("id", slotId);
  await supabase.from("applicants").update({ stage: "interview_booked" }).eq("id", applicantId).eq("center_id", staff.center_id);

  await notifyInterviewBooked({ applicantId, slotId, centerId: staff.center_id });

  revalidatePath(`/dashboard/admissions/${applicantId}`);
}

// Centre-level policy, not routine admissions handling -- same reasoning as
// every other admin-only toggle in this app (centre.settings.edit). Autobook
// can never be turned on while shadow mode is off; the migration's own check
// constraint backs this up, but refusing here means the toggle in the UI
// never round-trips into a form error the admin has to decode.
export async function toggleAdmissionsAiShadowMode(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  if (staff.role !== "admin") return;
  const enabled = formData.get("enabled") === "true";
  const supabase = await createClient();
  const update: Database["public"]["Tables"]["centers"]["Update"] = { admissions_ai_shadow_mode_enabled: enabled };
  if (!enabled) update.admissions_ai_autobook_enabled = false;
  await supabase.from("centers").update(update).eq("id", staff.center_id);
  revalidatePath("/dashboard/admissions/settings");
}

export async function toggleAdmissionsAiAutobook(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  if (staff.role !== "admin") return;
  const enabled = formData.get("enabled") === "true";
  const supabase = await createClient();

  const { data: center } = await supabase.from("centers").select("admissions_ai_shadow_mode_enabled").eq("id", staff.center_id).maybeSingle();
  if (enabled && !center?.admissions_ai_shadow_mode_enabled) return;

  await supabase.from("centers").update({ admissions_ai_autobook_enabled: enabled }).eq("id", staff.center_id);
  revalidatePath("/dashboard/admissions/settings");
}

// Staff-triggered send, for the borderline lane (a human decided) or a
// manual re-send -- same picker-link email the clear lane's cron sends
// automatically, just immediate and human-initiated, so no hold applies.
export async function sendInterviewInviteManually(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  if (typeof applicantId !== "string") return;

  const admin = createAdminClient();
  const { data: applicant } = await admin.from("applicants").select("center_id").eq("id", applicantId).maybeSingle();
  if (!applicant || applicant.center_id !== staff.center_id) return;

  const { sendInterviewInvite } = await import("@/lib/admissions-invite");
  await sendInterviewInvite(admin, applicantId);

  revalidatePath(`/dashboard/admissions/${applicantId}`);
}

// "A 15-minute hold between verdict and email... a cancellation window with
// a Hold button in the admin queue" (review-notes.md). Clicking it stops
// the auto-send permanently -- it does not merely pause it -- so the
// applicant falls back to the ordinary human-decided path, same as any
// other applicant. A held invitation can still be sent by hand afterwards
// via the normal booking action above.
export async function holdAutoSentInterview(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  if (typeof applicantId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("applicants")
    .update({ interview_auto_send_cancelled_at: new Date().toISOString(), interview_auto_send_cancelled_by: staff.id })
    .eq("id", applicantId)
    .eq("center_id", staff.center_id)
    .is("interview_auto_send_sent_at", null);

  revalidatePath(`/dashboard/admissions/${applicantId}`);
}

/**
 * "Interview booked -> To whoever holds admissions and to the named
 * interviewer, with a link to the marked task."
 *
 * Two recipients, deduplicated -- when the person who holds admissions is also
 * the interviewer (routine in a small centre) they get one email, not two
 * copies of the same sentence.
 *
 * Never throws: a booking that succeeded must not be reported as failed
 * because a notification didn't go out. The booking is already visible in
 * Connect, which is the record; this email is a convenience on top of it.
 */
async function notifyInterviewBooked(input: { applicantId: string; slotId: string; centerId: string }) {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    const [{ data: slot }, { data: applicant }, { data: center }] = await Promise.all([
      admin
        .from("interview_slots")
        .select("slot_date, slot_time, mode, interviewer_id, second_interviewer_id")
        .eq("id", input.slotId)
        .maybeSingle(),
      admin.from("applicants").select("full_name, intake_course_id").eq("id", input.applicantId).maybeSingle(),
      admin.from("centers").select("name, admissions_email").eq("id", input.centerId).maybeSingle(),
    ]);
    if (!slot || !applicant || !center) return;

    const { data: course } = await admin.from("courses").select("name").eq("id", applicant.intake_course_id).maybeSingle();

    // The interviewer, the second interviewer on a panel, and whoever holds
    // the admissions area. getAreaHolders is the single source for the
    // last one -- "whoever holds admissions" is a real assignment, not a role.
    const { getAreaHolders } = await import("@/lib/auth/area-holders");
    const holders = await getAreaHolders(input.centerId);
    const admissionsHolderId = holders.get("admissions")?.profileId ?? null;

    const ids = [slot.interviewer_id, slot.second_interviewer_id, admissionsHolderId].filter(
      (id): id is string => typeof id === "string" && id.length > 0
    );
    if (!ids.length) return;

    const { data: people } = await admin.from("profiles").select("id, full_name, email").in("id", [...new Set(ids)]);
    if (!people?.length) return;

    const when = `${new Date(`${slot.slot_date}T${slot.slot_time}`).toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    })} (${slot.mode === "online" ? "online" : "in person"})`;

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://celtaconnect.com";
    const { sendApplicantEmail, interviewBookedEmailHtml } = await import("@/lib/admissions-email");

    for (const person of people) {
      if (!person.email) continue;
      await sendApplicantEmail({
        centerName: center.name,
        centerAdmissionsEmail: center.admissions_email,
        to: person.email,
        subject: "An interview has been booked",
        centerId: input.centerId,
        applicantId: input.applicantId,
        type: "interview_booked",
        recipientName: person.full_name,
        html: interviewBookedEmailHtml({
          recipientName: person.full_name,
          applicantName: applicant.full_name,
          courseName: course?.name ?? "the course",
          when,
          markedTaskUrl: `${base}/dashboard/admissions/${input.applicantId}`,
        }),
      });
    }
  } catch {
    // See above -- a notification failure never fails the booking.
  }
}

// ---- Interview availability: pattern, blocks, generation ----

export interface RegenState {
  error: string | null;
  created?: number;
}

// "Each interviewer sets a weekly pattern once. The app produces bookable
// slots from it." Adding a pattern window doesn't itself create slots --
// regenerate (below) reads every active pattern and writes the actual
// interview_slots rows, so the two stay explicit and separate.
export async function addAvailabilityPattern(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const interviewerId = (formData.get("interviewer_id") as string | null) || staff.id;
  const weekday = formData.get("weekday");
  const startTime = formData.get("start_time");
  const endTime = formData.get("end_time");
  const mode = formData.get("mode");
  if (
    typeof weekday !== "string" ||
    typeof startTime !== "string" ||
    typeof endTime !== "string" ||
    typeof mode !== "string" ||
    !["online", "face_to_face"].includes(mode) ||
    !startTime ||
    !endTime ||
    startTime >= endTime
  ) {
    return;
  }

  const supabase = await createClient();
  await supabase.from("interview_availability_patterns").insert({
    center_id: staff.center_id,
    interviewer_id: interviewerId,
    weekday: Number(weekday),
    start_time: startTime,
    end_time: endTime,
    mode: mode as "online" | "face_to_face",
  });
  revalidatePath("/dashboard/admissions");
}

export async function removeAvailabilityPattern(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  const supabase = await createClient();
  await supabase.from("interview_availability_patterns").delete().eq("id", id).eq("center_id", staff.center_id);
  revalidatePath("/dashboard/admissions");
}

// "A single afternoon... a whole week... centre closures set once for
// everybody." interviewer_id left blank means centre-wide. Blocking an
// already-booked slot is refused below rather than silently orphaning an
// applicant who is expecting to be there.
export async function addInterviewBlock(_prevState: RegenState, formData: FormData): Promise<RegenState> {
  const staff = await requireAdmissionsHandler();
  const interviewerId = (formData.get("interviewer_id") as string | null) || null;
  const startDate = formData.get("start_date");
  const endDate = (formData.get("end_date") as string | null) || startDate;
  const startTime = (formData.get("start_time") as string | null) || null;
  const endTime = (formData.get("end_time") as string | null) || null;
  const reason = (formData.get("reason") as string | null)?.trim() || null;
  if (typeof startDate !== "string" || !startDate || typeof endDate !== "string" || endDate < startDate) {
    return { error: "Give at least a start date." };
  }

  const supabase = await createClient();

  // "Blocking it requires rebooking the applicant first" -- refuse the
  // block outright rather than silently dropping a booked applicant.
  let bookedQuery = supabase
    .from("interview_slots")
    .select("id", { count: "exact", head: true })
    .eq("center_id", staff.center_id)
    .gte("slot_date", startDate)
    .lte("slot_date", endDate)
    .not("booked_applicant_id", "is", null);
  if (interviewerId) bookedQuery = bookedQuery.eq("interviewer_id", interviewerId);
  const { count: bookedCount } = await bookedQuery;
  if (bookedCount && bookedCount > 0) {
    return { error: `${bookedCount} slot${bookedCount === 1 ? " is" : "s are"} already booked in that window -- rebook ${bookedCount === 1 ? "it" : "them"} first.` };
  }

  const { error } = await supabase.from("interview_blocks").insert({
    center_id: staff.center_id,
    interviewer_id: interviewerId,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
    reason,
    blocked_by: staff.id,
  });
  if (error) return { error: "Could not save. Try again." };

  // "Unbooked slots disappear from the applicant's view immediately" --
  // remove any now-blocked unbooked slots that already existed.
  let cleanupQuery = supabase
    .from("interview_slots")
    .delete()
    .eq("center_id", staff.center_id)
    .gte("slot_date", startDate)
    .lte("slot_date", endDate)
    .is("booked_applicant_id", null);
  if (interviewerId) cleanupQuery = cleanupQuery.eq("interviewer_id", interviewerId);
  await cleanupQuery;

  revalidatePath("/dashboard/admissions");
  return { error: null };
}

export async function removeInterviewBlock(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const id = formData.get("id");
  if (typeof id !== "string") return;
  const supabase = await createClient();
  await supabase.from("interview_blocks").delete().eq("id", id).eq("center_id", staff.center_id);
  revalidatePath("/dashboard/admissions");
}

export async function updateInterviewGenerationSettings(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const slotMinutes = Number(formData.get("interview_slot_minutes"));
  const gapMinutes = Number(formData.get("interview_gap_minutes"));
  const weeksAhead = Number(formData.get("interview_weeks_ahead"));
  const cutoffHours = Number(formData.get("interview_cutoff_hours"));
  if (![slotMinutes, gapMinutes, weeksAhead, cutoffHours].every((n) => Number.isFinite(n) && n >= 0)) return;

  const supabase = await createClient();
  await supabase
    .from("centers")
    .update({
      interview_slot_minutes: slotMinutes,
      interview_gap_minutes: gapMinutes,
      interview_weeks_ahead: weeksAhead,
      interview_cutoff_hours: cutoffHours,
    })
    .eq("id", staff.center_id);
  revalidatePath("/dashboard/admissions");
}

// "Nobody maintains a calendar. Change the pattern and every unbooked slot
// regenerates." Regenerates for the acting interviewer (or, for someone
// who only holds admissions and doesn't interview themselves, for whoever
// interviewer_id names -- an admin regenerating on behalf of a colleague).
export async function regenerateInterviewSlots(_prevState: RegenState, formData: FormData): Promise<RegenState> {
  const staff = await requireAdmissionsHandler();
  const interviewerId = (formData.get("interviewer_id") as string | null) || staff.id;

  const supabase = await createClient();
  const result = await regenerateSlotsForInterviewer(supabase, staff.center_id, interviewerId);
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard/admissions");
  return { error: null, created: result.created };
}

// ---- Marking scheme (selection task) ----

export async function saveMarkingScheme(_prevState: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  if (typeof applicantId !== "string") return { error: "Something went wrong. Refresh and try again." };
  if (!canDecideAdmissions(staff)) {
    return { error: "Only a verified course tutor or a nominated admissions decider can mark the selection task." };
  }

  const rows = ["language_awareness", "accuracy", "organisation", "range", "substance"] as const;
  type ApplicantUpdate = Database["public"]["Tables"]["applicants"]["Update"];
  const update: ApplicantUpdate = { marked_by: staff.id, marked_at: new Date().toISOString() };
  for (const row of rows) {
    const value = formData.get(`marking_${row}`);
    const note = formData.get(`marking_${row}_note`);
    const key = `marking_${row}` as keyof ApplicantUpdate;
    const noteKey = `marking_${row}_note` as keyof ApplicantUpdate;
    if (typeof value === "string" && ["above", "at", "below"].includes(value)) {
      (update as Record<string, unknown>)[key] = value;
      if (value === "below" && (typeof note !== "string" || !note.trim())) {
        return { error: `A note is required for any row marked "Below standard".` };
      }
    }
    (update as Record<string, unknown>)[noteKey] = typeof note === "string" ? note.trim() || null : null;
  }

  // The tutor's own words. Recording who last edited it is what makes
  // "human-written, never generated" checkable rather than merely claimed --
  // an untouched AI suggestion has no editor.
  const feedback = (formData.get("task_feedback") as string | null)?.trim() || null;
  if (feedback !== null) {
    (update as Record<string, unknown>).task_feedback = feedback;
    (update as Record<string, unknown>).task_feedback_edited_by = staff.id;
    (update as Record<string, unknown>).task_feedback_edited_at = new Date().toISOString();
  }

  const supabase = await createClient();
  const { error } = await supabase.from("applicants").update(update).eq("id", applicantId).eq("center_id", staff.center_id);
  if (error) return { error: "Could not save the marking. Try again." };

  revalidatePath(`/dashboard/admissions/${applicantId}`);
  return { error: null };
}

// ---- Interview record ----

export async function saveInterviewRecord(_prevState: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  const slotId = (formData.get("slot_id") as string | null) || null;
  if (typeof applicantId !== "string") return { error: "Something went wrong. Refresh and try again." };
  if (!canDecideAdmissions(staff)) {
    return { error: "Only a verified course tutor or a nominated admissions decider can record an interview." };
  }

  const fixedIds = formData.getAll("fixed_question_id") as string[];
  const fixedTexts = formData.getAll("fixed_question_text") as string[];
  const fixedAnswers = formData.getAll("fixed_answer") as string[];
  const fixedQuestions = fixedIds.map((id, i) => ({ question_id: id, question_text: fixedTexts[i], answer_text: fixedAnswers[i] ?? "" }));

  const drawnTexts = formData.getAll("drawn_question_text") as string[];
  const drawnAnswers = formData.getAll("drawn_answer") as string[];
  const drawnReasons = formData.getAll("drawn_reason") as string[];
  const drawnQuestions = drawnTexts
    .map((text, i) => ({ question_text: text, answer_text: drawnAnswers[i] ?? "", drawn_reason: drawnReasons[i] || null }))
    .filter((q) => q.question_text.trim());

  const interviewerSignature = (formData.get("interviewer_signature_name") as string | null)?.trim() || null;
  const applicantSignature = (formData.get("applicant_signature_name") as string | null)?.trim() || null;
  const overallNotes = (formData.get("overall_notes") as string | null)?.trim() || null;

  if (!interviewerSignature) {
    return { error: "The interviewer's signature is required to save the interview record." };
  }

  const supabase = await createClient();
  const { data: applicant } = await supabase.from("applicants").select("center_id, full_name").eq("id", applicantId).maybeSingle();
  if (!applicant || applicant.center_id !== staff.center_id) return { error: "Applicant not found." };

  const { data: existing } = await supabase.from("interview_records").select("id").eq("applicant_id", applicantId).maybeSingle();

  const record = {
    applicant_id: applicantId,
    slot_id: slotId,
    fixed_questions: fixedQuestions,
    drawn_questions: drawnQuestions,
    interviewer_signature_name: interviewerSignature,
    interviewer_signed_at: new Date().toISOString(),
    applicant_signature_name: applicantSignature,
    applicant_signed_at: applicantSignature ? new Date().toISOString() : null,
    overall_notes: overallNotes,
    created_by: staff.id,
  };

  const { error } = existing
    ? await supabase.from("interview_records").update(record).eq("id", existing.id)
    : await supabase.from("interview_records").insert(record);
  if (error) return { error: "Could not save the interview record. Try again." };

  await supabase.from("applicants").update({ stage: "interview_completed" }).eq("id", applicantId);
  await supabase.from("admissions_notifications").insert({
    center_id: staff.center_id,
    applicant_id: applicantId,
    type: "interview_completed",
    message: "Interview completed -- a decision is needed.",
  });
  {
    const { notifyAdmissionsHandlers } = await import("@/lib/admissions-notify");
    const { interviewCompletedEmailHtml } = await import("@/lib/admissions-email");
    const siteUrl = process.env.SITE_URL ?? "https://celtaconnect.com";
    const reviewUrl = `${siteUrl}/dashboard/admissions/${applicantId}`;
    const admin = createAdminClient();
    await notifyAdmissionsHandlers(admin, {
      centerId: staff.center_id,
      applicantId,
      emailType: "interview_completed",
      subject: `Decision needed -- ${applicant.full_name}`,
      pushBody: `${applicant.full_name}'s interview is complete -- a decision is needed.`,
      pushUrl: reviewUrl,
      buildEmailHtml: (recipientName) => interviewCompletedEmailHtml({ recipientName, applicantName: applicant.full_name, reviewUrl }),
    }).catch(() => null);
  }

  revalidatePath(`/dashboard/admissions/${applicantId}`);
  return { error: null };
}

// ---- Decisions that don't depend on Phase D/E infrastructure ----
// "Both require a human-written reason before they can be sent, and
// neither is ever generated." The reason is captured and the stage moves
// now; actually SENDING the rejection email is Phase E.

export interface ReferFormState {
  error: string | null;
}

// build-spec.md §14 "Sharing between branches": "One person holding
// admissions at both branches refers in a single action. Where nobody
// spans the two, it becomes a request the receiving branch accepts." This
// is the single-action case. The UI (refer-form.tsx) only ever offers
// destination centres this same check would pass, but the check is
// re-run here server-side rather than trusted from the form. The request/
// accept workflow for "nobody spans both" is below (requestReferralAction /
// acceptReferralRequestAction / declineReferralRequestAction).
export async function referApplicantAction(_prevState: ReferFormState, formData: FormData): Promise<ReferFormState> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  const destination = formData.get("destination");
  if (typeof applicantId !== "string" || !applicantId || typeof destination !== "string" || !destination) {
    return { error: "Pick a branch and intake to refer to." };
  }
  if (staff.role !== "admin") {
    return { error: "Only a centre admin holding admissions at both branches can refer a candidate." };
  }
  const [toCenterId, toCourseId] = destination.split("::");
  if (!toCenterId || !toCourseId) return { error: "Pick a branch and intake to refer to." };

  const admin = createAdminClient();
  const { data: fromCentre } = await admin.from("centers").select("id, organisation_id").eq("id", staff.center_id).maybeSingle();
  const { data: toCentre } = await admin.from("centers").select("id, organisation_id").eq("id", toCenterId).maybeSingle();
  if (!fromCentre?.organisation_id || fromCentre.organisation_id !== toCentre?.organisation_id) {
    return { error: "That branch isn't part of your organisation." };
  }
  const { data: grant } = await admin
    .from("centre_roles")
    .select("role")
    .eq("profile_id", staff.id)
    .eq("center_id", toCenterId)
    .is("revoked_at", null)
    .in("role", ["centre_administrator", "centre_owner"])
    .maybeSingle();
  if (!grant) {
    return { error: "You don't hold admissions at that branch -- ask someone there to accept a referral request instead." };
  }

  const result = await referApplicant({
    applicantId,
    toCenterId,
    toCourseId,
    byProfileId: staff.id,
    fromCenterId: staff.center_id,
  });
  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/admissions/${applicantId}`);
  return { error: null };
}

// "Where nobody spans the two, it becomes a request the receiving branch
// accepts." Any centre admin at the destination branch is offered as a
// possible target -- not access-filtered like referApplicantAction's
// destinations, since the whole point is the requester doesn't hold
// anything there.
export async function requestReferralAction(_prevState: ReferFormState, formData: FormData): Promise<ReferFormState> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  const toCenterId = formData.get("to_center_id");
  if (typeof applicantId !== "string" || !applicantId || typeof toCenterId !== "string" || !toCenterId) {
    return { error: "Pick a branch to send the request to." };
  }
  if (staff.role !== "admin") {
    return { error: "Only a centre admin can request a referral." };
  }

  const { requestBranchReferral } = await import("@/lib/admissions-referral");
  const result = await requestBranchReferral({
    applicantId,
    fromCenterId: staff.center_id,
    toCenterId,
    byProfileId: staff.id,
  });
  if (result.error) return { error: result.error };

  revalidatePath(`/dashboard/admissions/${applicantId}`);
  return { error: null };
}

export interface ReferralDecisionState {
  error: string | null;
}

// Re-checks the viewer actually holds admissions at the request's
// destination branch server-side -- the page only shows this form to
// someone it already believes qualifies, but that belief isn't trusted here.
async function requireReceivingBranchAdmin(toCenterId: string) {
  const staff = await requireAdmissionsHandler();
  if (staff.role !== "admin") throw new Error("Only a centre admin can decide a referral request.");
  if (staff.center_id === toCenterId) return staff;

  const admin = createAdminClient();
  const { data: grant } = await admin
    .from("centre_roles")
    .select("role")
    .eq("profile_id", staff.id)
    .eq("center_id", toCenterId)
    .is("revoked_at", null)
    .in("role", ["centre_administrator", "centre_owner"])
    .maybeSingle();
  if (!grant) throw new Error("You don't hold admissions at that branch.");
  return staff;
}

export async function acceptReferralRequestAction(
  _prevState: ReferralDecisionState,
  formData: FormData
): Promise<ReferralDecisionState> {
  const requestId = formData.get("request_id");
  const toCenterId = formData.get("to_center_id");
  const toCourseId = formData.get("to_course_id");
  if (
    typeof requestId !== "string" || !requestId ||
    typeof toCenterId !== "string" || !toCenterId ||
    typeof toCourseId !== "string" || !toCourseId
  ) {
    return { error: "Pick which intake to place them into." };
  }

  let staff;
  try {
    staff = await requireReceivingBranchAdmin(toCenterId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Not authorised." };
  }

  const { acceptBranchReferralRequest } = await import("@/lib/admissions-referral");
  const result = await acceptBranchReferralRequest({ requestId, toCourseId, byProfileId: staff.id });
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard/admissions/referral-requests");
  if (result.newApplicantId) revalidatePath(`/dashboard/admissions/${result.newApplicantId}`);
  return { error: null };
}

export async function declineReferralRequestAction(
  _prevState: ReferralDecisionState,
  formData: FormData
): Promise<ReferralDecisionState> {
  const requestId = formData.get("request_id");
  const toCenterId = formData.get("to_center_id");
  const reason = formData.get("reason");
  if (typeof requestId !== "string" || !requestId || typeof toCenterId !== "string" || !toCenterId) {
    return { error: "Missing request." };
  }

  let staff;
  try {
    staff = await requireReceivingBranchAdmin(toCenterId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Not authorised." };
  }

  const { declineBranchReferralRequest } = await import("@/lib/admissions-referral");
  const result = await declineBranchReferralRequest({
    requestId,
    byProfileId: staff.id,
    reason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
  });
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard/admissions/referral-requests");
  return { error: null };
}

export async function rejectApplicant(_prevState: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  const reason = formData.get("rejection_reason");
  const stage = formData.get("stage");

  if (typeof applicantId !== "string" || typeof reason !== "string" || !reason.trim()) {
    return { error: "A written reason is required to reject an applicant." };
  }
  if (stage !== "rejected_before_interview" && stage !== "rejected_after_interview") {
    return { error: "Something went wrong. Refresh and try again." };
  }
  if (!canDecideAdmissions(staff)) {
    return { error: "Only a verified course tutor or a nominated admissions decider can reject an applicant." };
  }

  const supabase = await createClient();
  const { data: applicant } = await supabase
    .from("applicants")
    .select("full_name, email, intake_course_id")
    .eq("id", applicantId)
    .eq("center_id", staff.center_id)
    .maybeSingle();
  if (!applicant) return { error: "Applicant not found." };

  const { error } = await supabase
    .from("applicants")
    .update({
      stage,
      rejection_reason: reason.trim(),
      rejected_at: new Date().toISOString(),
      rejected_by: staff.id,
    })
    .eq("id", applicantId)
    .eq("center_id", staff.center_id);
  if (error) return { error: "Could not save the decision. Try again." };

  let emailError: string | null = null;
  const [{ data: course }, { data: center }] = await Promise.all([
    supabase.from("courses").select("name").eq("id", applicant.intake_course_id).maybeSingle(),
    supabase.from("centers").select("name, admissions_email").eq("id", staff.center_id).maybeSingle(),
  ]);
  // Two different emails, not one with a variable. All Emails.dc.html lists
  // "Not suitable - after task" and "Not suitable - after interview"
  // separately: the second is "written after meeting them, so it can be
  // specific about the conversation", and it says so ("thank you for coming to
  // interview"). Sending the after-task wording to someone who sat an interview
  // reads as though nobody remembered they came.
  //
  // Both reply to the tutor who wrote the reason rather than to admissions --
  // "Replies go to the tutor who wrote it". A reply to a rejection is almost
  // always "what did you mean?", and only one person can answer it.
  const afterInterview = stage === "rejected_after_interview";
  const { error: sendError } = await sendApplicantEmail({
    centerName: center?.name ?? "Your centre",
    centerAdmissionsEmail: center?.admissions_email ?? null,
    to: applicant.email,
    subject: afterInterview
      ? "We are not able to offer you a place"
      : `${course?.name ?? "Your application"} -- update on your application`,
    centerId: staff.center_id,
    applicantId: applicantId,
    type: afterInterview ? "rejection_after_interview" : "rejection",
    sentBy: staff.id,
    tutorEmail: staff.email,
    html: afterInterview
      ? rejectionAfterInterviewEmailHtml({
          applicantName: applicant.full_name,
          interviewDate: null,
          reason: reason.trim(),
          // "Ramy Sakr will call you this week" -- a named person, and it is
          // the tutor who wrote the reason, so a reply and a call reach the
        })
      : rejectionEmailHtml({
          applicantName: applicant.full_name,
          centreName: center?.name ?? "this centre",
          reason: reason.trim(),
        }),
  });
  emailError = sendError;

  revalidatePath(`/dashboard/admissions/${applicantId}`);
  revalidatePath("/dashboard/admissions");
  return { error: emailError ? `Decision recorded, but the email failed to send: ${emailError}` : null };
}

// ---- Offer, waivers, waiting list ----
// Instalment/payment tracking itself moved to src/lib/payments/ (the
// provider-bridge model, superseding the "payment is outside the app,
// ever" position this comment used to state -- Ramy revisited that later
// the same day, 2026-08-14. fee_amount/fee_currency here stay as the
// headline figure captured at offer time and shown in the offer email;
// FeeTrackingForm/fee_paid are gone, replaced by PaymentsPanel.

export async function sendOffer(_prevState: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  const feeAmount = formData.get("fee_amount");
  const feeCurrency = formData.get("fee_currency");
  const acceptBy = formData.get("offer_accept_by");

  if (typeof applicantId !== "string" || typeof acceptBy !== "string" || !acceptBy) {
    return { error: "Set an accept-by date to send an offer." };
  }
  if (!canDecideAdmissions(staff)) {
    return { error: "Only a verified course tutor or a nominated admissions decider can send an offer." };
  }

  const supabase = await createClient();
  const { data: applicant } = await supabase
    .from("applicants")
    .select("full_name, email, intake_course_id, deposit_paid_at, task_feedback")
    .eq("id", applicantId)
    .eq("center_id", staff.center_id)
    .maybeSingle();
  if (!applicant) return { error: "Applicant not found." };

  // The deposit is what lets a centre invite someone before the balance is
  // settled, so sending an offer without one is worth stopping on -- once.
  // Deliberately a warning and not a block: centres take deposits by bank
  // transfer and out of band all the time, and a hard gate would have staff
  // fighting the app on day one. Tick the box and it proceeds.
  if (!applicant.deposit_paid_at && formData.get("confirm_no_deposit") !== "1") {
    return { error: "No deposit is recorded for this applicant. Record one first, or tick to send the offer anyway." };
  }

  const offerToken = crypto.randomUUID();
  const { error } = await supabase
    .from("applicants")
    .update({
      stage: "offer_sent",
      offer_sent_at: new Date().toISOString(),
      offer_accept_by: acceptBy,
      offer_token: offerToken,
      fee_amount: typeof feeAmount === "string" && feeAmount ? Number(feeAmount) : null,
      fee_currency: typeof feeCurrency === "string" && feeCurrency ? feeCurrency.trim().toUpperCase() : null,
      // This is a fresh, staff-chosen offer -- clear any leftover
      // place-freed 48h fields from a prior waiting-list cycle, otherwise
      // a stale past place_offer_expires_at makes this brand-new offer
      // look already expired (offer/[token]/page.tsx and acceptOffer both
      // check it unconditionally when set) and the next cron run would
      // wrongly treat it as a lapsed place-freed offer and auto-advance
      // the waiting list on top of a genuine, still-open offer.
      place_offered_at: null,
      place_offer_expires_at: null,
    })
    .eq("id", applicantId)
    .eq("center_id", staff.center_id);
  if (error) return { error: "Could not record the offer. Try again." };

  // "If the copies fail, the booking still happened" -- same principle
  // applied here: the offer is recorded regardless of whether the email
  // send succeeds, and a failure surfaces without undoing the record.
  const siteUrl = process.env.SITE_URL;
  let emailError: string | null = null;
  if (siteUrl) {
    const [{ data: course }, { data: center }, { data: mct }] = await Promise.all([
      supabase
        .from("courses")
        .select("name, start_date, end_date, deposit_amount, fee_currency")
        .eq("id", applicant.intake_course_id)
        .maybeSingle(),
      supabase.from("centers").select("name, admissions_email").eq("id", staff.center_id).maybeSingle(),
      supabase
        .from("course_tutors")
        .select("profiles(full_name)")
        .eq("course_id", applicant.intake_course_id)
        .eq("tutor_role", "main_course_tutor")
        .is("left_at", null)
        .maybeSingle(),
    ]);
    const currency = (typeof feeCurrency === "string" && feeCurrency ? feeCurrency.trim().toUpperCase() : course?.fee_currency) || "";
    const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    const mctName = (mct?.profiles as { full_name?: string } | null)?.full_name ?? null;

    // Ramy, 2026-08-16: "the Connect account will only be set up after they
    // pay a deposit; they will be sent a different email after that" -- this
    // is the deposit ask, not an account-creation link. releaseWorkspace()
    // sends the second email (welcomeEmailHtml) once a deposit is actually
    // recorded, and only then does /offer/[token] let the account get made.
    const { error: sendError } = await sendApplicantEmail({
      centerName: center?.name ?? "Your centre",
      centerAdmissionsEmail: center?.admissions_email ?? null,
      to: applicant.email,
      subject: `your place on ${course?.name ?? "the course"}`,
      centerId: staff.center_id,
      applicantId: applicantId,
      type: "offer",
      sentBy: staff.id,
      html: acceptancePlaceEmailHtml({
        candidateName: applicant.full_name,
        courseName: course?.name ?? "the course",
        courseDates:
          course?.start_date && course?.end_date
            ? `${fmtDate(course.start_date)} to ${fmtDate(course.end_date)}`
            : "the dates confirmed with you",
        centreLocation: center?.name ?? "the centre",
        feeAmount:
          typeof feeAmount === "string" && feeAmount
            ? `${Number(feeAmount).toLocaleString("en-GB")} ${currency}`.trim()
            : "as discussed with you",
        depositAmount: course?.deposit_amount ? `${Number(course.deposit_amount).toLocaleString("en-GB")} ${currency}`.trim() : "a deposit to be confirmed with you",
        depositBy: fmtDate(acceptBy),
        balanceBy: course?.start_date ? fmtDate(course.start_date) : "before the course starts",
        payUrl: null,
        officeContact: center?.admissions_email ?? "the centre office",
        depositAlreadyPaid: Boolean(applicant.deposit_paid_at),
        directorName: mctName ?? "Your course tutor",
        directorRole: "Course Director",
      }),
    });
    emailError = sendError;
  } else {
    emailError = "SITE_URL is missing -- the offer was recorded but no email was sent.";
  }

  revalidatePath(`/dashboard/admissions/${applicantId}`);
  revalidatePath("/dashboard/admissions");
  return { error: emailError ? `Offer recorded, but the email failed to send: ${emailError}` : null };
}

export async function setFeePaid(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  const paid = formData.get("paid") === "true";
  const note = (formData.get("fee_paid_note") as string | null)?.trim() || null;
  if (typeof applicantId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("applicants")
    .update(
      paid
        ? { fee_paid: true, fee_paid_marked_by: staff.id, fee_paid_note: note, fee_paid_at: new Date().toISOString() }
        : { fee_paid: false, fee_paid_marked_by: null, fee_paid_note: null, fee_paid_at: null }
    )
    .eq("id", applicantId)
    .eq("center_id", staff.center_id);

  revalidatePath(`/dashboard/admissions/${applicantId}`);
}

export async function recordWaiver(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  const note = formData.get("waiver_note");
  const role = formData.get("waiver_agreed_role");
  if (typeof applicantId !== "string" || typeof note !== "string" || !note.trim() || typeof role !== "string" || !role.trim()) return;
  if (!canDecideAdmissions(staff)) return;

  const supabase = await createClient();
  await supabase
    .from("applicants")
    .update({ waiver_note: note.trim(), waiver_agreed_by: staff.id, waiver_agreed_role: role.trim() })
    .eq("id", applicantId)
    .eq("center_id", staff.center_id);

  revalidatePath(`/dashboard/admissions/${applicantId}`);
}

// "Position, the course, and a date by which they will hear either way."
// Position is the next free slot in this intake's existing waiting list,
// not user-entered -- the list is worked in order.
export async function addToWaitingList(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  const hearBy = formData.get("waiting_list_hear_by");
  if (typeof applicantId !== "string" || typeof hearBy !== "string" || !hearBy) return;
  if (!canDecideAdmissions(staff)) return;

  const supabase = await createClient();
  const { data: applicant } = await supabase
    .from("applicants")
    .select("full_name, email, intake_course_id")
    .eq("id", applicantId)
    .maybeSingle();
  if (!applicant) return;

  const { count } = await supabase
    .from("applicants")
    .select("id", { count: "exact", head: true })
    .eq("intake_course_id", applicant.intake_course_id)
    .eq("stage", "waiting_list");

  const position = (count ?? 0) + 1;
  const { error } = await supabase
    .from("applicants")
    .update({ stage: "waiting_list", waiting_list_position: position, waiting_list_hear_by: hearBy })
    .eq("id", applicantId)
    .eq("center_id", staff.center_id);

  // "If the copies fail, the booking still happened" -- same principle as
  // the offer/rejection emails: the waiting-list placement is recorded
  // regardless of whether the confirmation send succeeds.
  if (!error) {
    const [{ data: course }, { data: center }] = await Promise.all([
      supabase.from("courses").select("name").eq("id", applicant.intake_course_id).maybeSingle(),
      supabase.from("centers").select("name, admissions_email").eq("id", staff.center_id).maybeSingle(),
    ]);
    await sendApplicantEmail({
      centerName: center?.name ?? "Your centre",
      centerAdmissionsEmail: center?.admissions_email ?? null,
      to: applicant.email,
      subject: `${course?.name ?? "Your application"} -- waiting list`,
      centerId: staff.center_id,
      applicantId: applicantId,
      type: "waiting_list",
      sentBy: staff.id,
      html: waitingListEmailHtml({
        applicantName: applicant.full_name,
        courseName: course?.name ?? "the course",
        // The design writes the position in words -- "You are second on the
        // waiting list" -- not "number 2".
        positionWord: ORDINAL_WORD[position] ?? `number ${position}`,
        hearBy,
        daysBeforeStart: "",
        nextCourseName: null,
      }),
    });
  }

  revalidatePath(`/dashboard/admissions/${applicantId}`);
  revalidatePath("/dashboard/admissions");
}

// ---- Place-freed offer ----
// "Triggered by a withdrawal, deferral, unaccepted or expired offer. The
// app names who is next and drafts it." A place freeing is something staff
// see happen elsewhere (a trainee withdrawal/deferral, or simply noticing
// an offer lapsed) -- this button is the single trigger point for all of
// those sources: the app itself picks who's next, not the staff member.
export async function offerNextPlace(_prevState: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdmissionsHandler();
  const intakeCourseId = formData.get("intake_course_id");
  if (typeof intakeCourseId !== "string" || !intakeCourseId) {
    return { error: "Something went wrong. Refresh and try again." };
  }
  if (!canDecideAdmissions(staff)) {
    return { error: "Only a verified course tutor or a nominated admissions decider can offer a place." };
  }

  const supabase = await createClient();
  const result = await offerNextWaitingListPlace(supabase, { centerId: staff.center_id, intakeCourseId });

  revalidatePath("/dashboard/admissions");
  if (result.offeredApplicantId === null) return { error: result.reason };
  return { error: null };
}

/**
 * Records a deposit against an applicant.
 *
 * Deposits usually arrive by bank transfer, outside anything Connect can see,
 * so this is a record of what a named person observed -- never a claim the app
 * processed a payment. Same "never 'confirmed', always 'marked by'" principle
 * the manual half of `payments` already uses.
 *
 * Lives on the applicant rather than inside a payment plan because the deposit
 * normally comes first: it secures the place, and the balance is scheduled
 * afterwards. See migration 0105.
 */
export async function recordDeposit(_prevState: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdmissionsHandler();
  if (!canDecideAdmissions(staff)) return { error: "You can't record payments." };

  const applicantId = formData.get("applicant_id") as string | null;
  const amountRaw = formData.get("deposit_amount") as string | null;
  const currency = (formData.get("deposit_currency") as string | null)?.trim().toUpperCase() || null;
  const note = (formData.get("deposit_note") as string | null)?.trim() || null;
  const clearing = formData.get("clear") === "1";

  if (!applicantId) return { error: "Missing the applicant." };

  const supabase = await createClient();

  if (clearing) {
    const { error } = await supabase
      .from("applicants")
      .update({ deposit_amount: null, deposit_currency: null, deposit_paid_at: null, deposit_marked_by: null, deposit_note: null })
      .eq("id", applicantId)
      .eq("center_id", staff.center_id);
    if (error) return { error: "Could not clear the deposit." };
    revalidatePath(`/dashboard/admissions/${applicantId}`);
    return { error: null };
  }

  const amount = amountRaw ? Number(amountRaw) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return { error: "How much was the deposit?" };

  const { error } = await supabase
    .from("applicants")
    .update({
      deposit_amount: amount,
      deposit_currency: currency,
      deposit_paid_at: new Date().toISOString(),
      deposit_marked_by: staff.id,
      deposit_note: note,
    })
    .eq("id", applicantId)
    .eq("center_id", staff.center_id);
  if (error) return { error: `Could not record the deposit: ${error.message}` };

  revalidatePath(`/dashboard/admissions/${applicantId}`);
  revalidatePath("/dashboard/admissions");
  revalidatePath("/centre");
  return { error: null };
}

// ---- The green light ----

/**
 * Releases workspace access and sends the invitation.
 *
 * Ramy, 2026-08-16: "The link only goes there once they are accepted on the
 * course, or once the centre admin signals that they are accepted. This could
 * be done after they pay in full, or pay a deposit, or they promise to pay.
 * But before they receive the Connect link, there should be a green light from
 * the centre."
 *
 * So the gate is a decision, not a payment. The reason is recorded because
 * "promised to pay" is a real, chosen state a centre needs to be able to see
 * later -- who is in on trust, and who should be chased.
 *
 * Idempotent: releasing twice does not send twice. A second click is far more
 * likely to be someone unsure whether the first worked than a deliberate
 * resend, and a duplicate "your workspace is ready" reads as a mistake.
 */
export async function releaseWorkspace(_prevState: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdmissionsHandler();
  if (!canDecideAdmissions(staff)) return { error: "You can't release workspace access." };

  const applicantId = formData.get("applicant_id");
  const reason = formData.get("reason");
  const note = (formData.get("note") as string | null)?.trim() || null;

  // Narrowed to the union rather than a string[], so the check that validates
  // the form value is the same one the database column enforces.
  const REASONS = ["paid_in_full", "deposit_paid", "promised_to_pay", "provider_confirmed", "other"] as const;
  type ReleaseReason = (typeof REASONS)[number];
  if (typeof applicantId !== "string" || typeof reason !== "string" || !REASONS.includes(reason as ReleaseReason)) {
    return { error: "Choose why access is being given." };
  }

  const supabase = await createClient();
  const { data: applicant } = await supabase
    .from("applicants")
    .select("id, full_name, email, intake_course_id, offer_token, workspace_released_at")
    .eq("id", applicantId)
    .eq("center_id", staff.center_id)
    .maybeSingle();
  if (!applicant) return { error: "Applicant not found." };
  if (applicant.workspace_released_at) {
    return { error: "They already have their link -- released earlier. Nothing sent." };
  }
  if (!applicant.offer_token) {
    return { error: "There's no offer link for them yet. Send the offer first." };
  }

  const { error: updateError } = await supabase
    .from("applicants")
    .update({
      workspace_released_at: new Date().toISOString(),
      workspace_released_by: staff.id,
      workspace_released_reason: reason as ReleaseReason,
      workspace_released_note: note,
    })
    .eq("id", applicantId)
    .eq("center_id", staff.center_id);
  if (updateError) return { error: `Could not record the release: ${updateError.message}` };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const [{ data: course }, { data: center }] = await Promise.all([
    admin
      .from("courses")
      .select("name, start_date, end_date, delivery_mode")
      .eq("id", applicant.intake_course_id)
      .maybeSingle(),
    admin.from("centers").select("name, admissions_email").eq("id", staff.center_id).maybeSingle(),
  ]);

  // Tutor names for "Your tutors are ..." -- the email says it plainly, so an
  // empty list simply drops the sentence rather than printing "Your tutors are".
  const { data: tutors } = await admin
    .from("course_tutors")
    .select("profiles(full_name)")
    .eq("course_id", applicant.intake_course_id);
  const tutorNames = (tutors ?? [])
    .map((t) => (t.profiles as { full_name?: string } | null)?.full_name)
    .filter((n): n is string => Boolean(n));

  const fmt = (iso: string | null) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "";
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://celtaconnect.com";

  const { welcomeEmailHtml } = await import("@/lib/admissions-email");
  const { error: sendError } = await sendApplicantEmail({
    centerName: center?.name ?? "Your centre",
    centerAdmissionsEmail: center?.admissions_email ?? null,
    to: applicant.email,
    subject: "your CELTA workspace is ready",
    centerId: staff.center_id,
    applicantId,
    type: "welcome",
    sentBy: staff.id,
    html: welcomeEmailHtml({
      candidateName: applicant.full_name,
      courseName: course?.name ?? "your course",
      centreName: center?.name ?? "the centre",
      tutorNames,
      courseFact: course?.name
        ? `${course.name}${course.delivery_mode === "online" ? ", fully online" : course.delivery_mode === "mixed" ? ", mixed mode" : ""}`
        : "Your course",
      startsFact: fmt(course?.start_date ?? null) || "Dates to be confirmed",
      preCourseTaskFact: "Pre-course task",
      setupUrl: `${base}/offer/${applicant.offer_token}`,
      readingListUrl: `${base}/resources?category=reading`,
    }),
  });

  revalidatePath(`/dashboard/admissions/${applicantId}`);
  revalidatePath("/dashboard/admissions");
  revalidatePath("/centre");
  // The release is recorded either way -- it happened, and hiding that because
  // an email bounced would leave the centre unable to see who has been let in.
  return { error: sendError ? `Access released, but the email failed to send: ${sendError}` : null };
}

// ---- Refunds ----

/**
 * Agree a refund, and later mark it settled.
 *
 * Two steps rather than one, because the gap between them is the whole reason
 * the "Refunds pending" figure exists: a centre that agreed a refund three
 * weeks ago and never sent the money needs to see that on its own dashboard.
 * A single "refunded" flag would hide exactly the case worth surfacing.
 */
export async function agreeRefund(_prevState: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdmissionsHandler();
  if (!canDecideAdmissions(staff)) return { error: "You can't agree refunds." };

  const applicantId = (formData.get("applicant_id") as string | null) || null;
  const amountRaw = formData.get("amount");
  const currency = (formData.get("currency") as string | null)?.trim().toUpperCase() || null;
  const reason = (formData.get("reason") as string | null)?.trim() || null;
  const settlement = formData.get("settlement") === "provider" ? "provider" : "manual";

  const amount = typeof amountRaw === "string" ? Number(amountRaw) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return { error: "How much is being refunded?" };
  if (!currency) return { error: "Which currency?" };

  const supabase = await createClient();
  const { error } = await supabase.from("refunds").insert({
    center_id: staff.center_id,
    applicant_id: applicantId,
    amount,
    currency,
    reason,
    settlement,
    agreed_by: staff.id,
  });
  if (error) return { error: `Could not record the refund: ${error.message}` };

  revalidatePath("/centre");
  revalidatePath("/centre/payments");
  if (applicantId) revalidatePath(`/dashboard/admissions/${applicantId}`);
  return { error: null };
}

export async function settleRefund(_prevState: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdmissionsHandler();
  if (!canDecideAdmissions(staff)) return { error: "You can't settle refunds." };

  const refundId = formData.get("refund_id");
  const cancel = formData.get("cancel") === "1";
  if (typeof refundId !== "string") return { error: "Something went wrong. Refresh and try again." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("refunds")
    .update(
      cancel
        // Cancelled, not deleted -- somebody was told a refund was coming, and
        // that conversation should not vanish from the record.
        ? { status: "cancelled", completed_at: new Date().toISOString(), completed_by: staff.id }
        : { status: "completed", completed_at: new Date().toISOString(), completed_by: staff.id }
    )
    .eq("id", refundId)
    .eq("center_id", staff.center_id)
    .eq("status", "pending");
  if (error) return { error: "Could not update the refund. Try again." };

  revalidatePath("/centre");
  revalidatePath("/centre/payments");
  return { error: null };
}
