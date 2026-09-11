"use client";

import { useActionState, useState } from "react";
import { saveInterviewRecord, type FormState } from "@/app/dashboard/admissions/actions";
import type { Database } from "@/lib/supabase/types";

// identity_checked_at / identity_document_type are migration-added (0291);
// the generated types lag, so the record is widened here.
type InterviewRecord = Database["public"]["Tables"]["interview_records"]["Row"] & {
  identity_checked_at?: string | null;
  identity_document_type?: string | null;
};

// Same set as migration 0291's check constraint and the action's own list.
const IDENTITY_DOCUMENTS = [
  ["passport", "Passport"],
  ["national_id", "National ID card"],
  ["driving_licence", "Driving licence"],
  ["other", "Other photo ID"],
] as const;

interface Question {
  id: string;
  question_text: string;
  coverage_area: string;
}

const initialState: FormState = { error: null };
const inputClass = "rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-sm text-ink outline-none focus:border-primary";

export function InterviewRecordForm({
  applicantId,
  slotId,
  questions,
  existingRecord,
}: {
  applicantId: string;
  /** Null when the interview was recorded without a booked slot (agreed by phone, or before the picker existed). */
  slotId: string | null;
  questions: Question[];
  existingRecord: InterviewRecord | null;
}) {
  const [state, action, pending] = useActionState(saveInterviewRecord, initialState);
  const existingFixed = new Map((existingRecord?.fixed_questions ?? []).map((q) => [q.question_id, q.answer_text]));
  const [drawnCount, setDrawnCount] = useState(Math.max(existingRecord?.drawn_questions.length ?? 0, 2));
  const [identityChecked, setIdentityChecked] = useState(Boolean(existingRecord?.identity_checked_at));

  return (
    <form action={action} className="flex flex-col gap-4 border-t border-border pt-4">
      <input type="hidden" name="applicant_id" value={applicantId} />
      {slotId ? <input type="hidden" name="slot_id" value={slotId} /> : null}

      {/* Handbook §7.2: "selection procedures must include authentication of
          the candidate's identity (e.g., checking passport details)". What is
          recorded is that it happened and what was seen -- never the number.
          The assessor's application-files view shows this line per applicant. */}
      <div className="flex flex-col gap-2 rounded-[6px] border border-border bg-card-inset/60 p-3">
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="identity_checked"
            value="1"
            checked={identityChecked}
            onChange={(e) => setIdentityChecked(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span>
            <span className="font-semibold">Identity checked — document seen</span>
            <span className="block text-xs text-muted">Required by Handbook §7.2. Note only which document; never its number.</span>
          </span>
        </label>
        {identityChecked ? (
          <label className="flex flex-wrap items-center gap-2 pl-6 text-xs text-muted">
            Document
            <select name="identity_document_type" defaultValue={existingRecord?.identity_document_type ?? "passport"} className={inputClass}>
              {IDENTITY_DOCUMENTS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <p className="text-sm font-semibold text-ink">Fixed questions</p>
      {questions.length === 0 ? (
        <p className="text-xs text-muted">No active questions in the bank -- add some in Settings first.</p>
      ) : (
        questions.map((q) => (
          <div key={q.id} className="flex flex-col gap-1.5">
            <input type="hidden" name="fixed_question_id" value={q.id} />
            <input type="hidden" name="fixed_question_text" value={q.question_text} />
            <label className="text-xs text-muted">{q.question_text}</label>
            <textarea name="fixed_answer" rows={2} defaultValue={existingFixed.get(q.id) ?? ""} className={inputClass} />
          </div>
        ))
      )}

      <p className="mt-2 text-sm font-semibold text-ink">
        Drawn questions -- from the weak areas the task reading flagged
      </p>
      {Array.from({ length: drawnCount }).map((_, i) => {
        const existing = existingRecord?.drawn_questions[i];
        return (
          <div key={i} className="flex flex-col gap-1.5">
            <input
              type="text"
              name="drawn_question_text"
              placeholder="Question asked"
              defaultValue={existing?.question_text ?? ""}
              className={inputClass}
            />
            <textarea name="drawn_answer" rows={2} placeholder="Answer" defaultValue={existing?.answer_text ?? ""} className={inputClass} />
            <input
              type="text"
              name="drawn_reason"
              placeholder="Why this was drawn (e.g. weak on classroom management in the task)"
              defaultValue={existing?.drawn_reason ?? ""}
              className={inputClass}
            />
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => setDrawnCount((n) => n + 1)}
        className="self-start text-xs text-muted hover:text-ink"
      >
        + Add another drawn question
      </button>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="overall_notes" className="text-sm font-semibold text-ink">
          Overall notes
        </label>
        <textarea id="overall_notes" name="overall_notes" rows={3} defaultValue={existingRecord?.overall_notes ?? ""} className={inputClass} />
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="interviewer_signature_name" className="text-xs text-muted">
            Interviewer signature (type your name) -- required
          </label>
          <input
            id="interviewer_signature_name"
            name="interviewer_signature_name"
            type="text"
            required
            defaultValue={existingRecord?.interviewer_signature_name ?? ""}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="applicant_signature_name" className="text-xs text-muted">
            Applicant signature (optional -- confirms notes reflect the conversation)
          </label>
          <input
            id="applicant_signature_name"
            name="applicant_signature_name"
            type="text"
            defaultValue={existingRecord?.applicant_signature_name ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save interview record"}
      </button>
    </form>
  );
}
