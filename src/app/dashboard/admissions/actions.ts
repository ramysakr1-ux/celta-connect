"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmissionsHandler, canDecideAdmissions } from "@/lib/admissions-access";
import type { Database } from "@/lib/supabase/types";

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

export async function bookInterviewSlot(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  const slotId = formData.get("slot_id");
  if (typeof applicantId !== "string" || typeof slotId !== "string" || !slotId) return;

  const supabase = await createClient();
  const { data: slot } = await supabase.from("interview_slots").select("id, center_id, booked_applicant_id").eq("id", slotId).maybeSingle();
  if (!slot || slot.center_id !== staff.center_id || slot.booked_applicant_id) return;

  await supabase.from("interview_slots").update({ booked_applicant_id: applicantId }).eq("id", slotId);
  await supabase.from("applicants").update({ stage: "interview_booked" }).eq("id", applicantId).eq("center_id", staff.center_id);
  revalidatePath(`/dashboard/admissions/${applicantId}`);
}

// ---- Marking scheme (selection task) ----

export async function saveMarkingScheme(_prevState: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  if (typeof applicantId !== "string") return { error: "Something went wrong. Refresh and try again." };

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
  const { data: applicant } = await supabase.from("applicants").select("center_id").eq("id", applicantId).maybeSingle();
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

  revalidatePath(`/dashboard/admissions/${applicantId}`);
  return { error: null };
}

// ---- Decisions that don't depend on Phase D/E infrastructure ----
// "Both require a human-written reason before they can be sent, and
// neither is ever generated." The reason is captured and the stage moves
// now; actually SENDING the rejection email is Phase E.

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

  revalidatePath(`/dashboard/admissions/${applicantId}`);
  revalidatePath("/dashboard/admissions");
  return { error: null };
}
