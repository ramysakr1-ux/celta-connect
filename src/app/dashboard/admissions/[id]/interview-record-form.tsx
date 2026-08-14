"use client";

import { useActionState, useState } from "react";
import { saveInterviewRecord, type FormState } from "@/app/dashboard/admissions/actions";
import type { Database } from "@/lib/supabase/types";

type InterviewRecord = Database["public"]["Tables"]["interview_records"]["Row"];

interface Question {
  id: string;
  question_text: string;
  coverage_area: string;
}

const initialState: FormState = { error: null };
const inputClass = "rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-primary";

export function InterviewRecordForm({
  applicantId,
  slotId,
  questions,
  existingRecord,
}: {
  applicantId: string;
  slotId: string;
  questions: Question[];
  existingRecord: InterviewRecord | null;
}) {
  const [state, action, pending] = useActionState(saveInterviewRecord, initialState);
  const existingFixed = new Map((existingRecord?.fixed_questions ?? []).map((q) => [q.question_id, q.answer_text]));
  const [drawnCount, setDrawnCount] = useState(Math.max(existingRecord?.drawn_questions.length ?? 0, 2));

  return (
    <form action={action} className="flex flex-col gap-4 border-t border-border pt-4">
      <input type="hidden" name="applicant_id" value={applicantId} />
      <input type="hidden" name="slot_id" value={slotId} />

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
