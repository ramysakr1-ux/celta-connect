"use client";

import { useActionState, useState } from "react";
import { saveMarkingScheme, type FormState } from "@/app/dashboard/admissions/actions";
import type { Database } from "@/lib/supabase/types";

type Applicant = Database["public"]["Tables"]["applicants"]["Row"];

const ROWS = [
  { key: "language_awareness", label: "Language awareness" },
  { key: "accuracy", label: "Accuracy" },
  { key: "organisation", label: "Organisation" },
  { key: "range", label: "Range" },
  { key: "substance", label: "Substance" },
] as const;

const initialState: FormState = { error: null };

export function MarkingForm({ applicant }: { applicant: Applicant }) {
  const [state, action, pending] = useActionState(saveMarkingScheme, initialState);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(ROWS.map((r) => [r.key, (applicant[`marking_${r.key}` as keyof Applicant] as string | null) ?? ""]))
  );

  return (
    <form action={action} className="card flex flex-col gap-4 p-6">
      <input type="hidden" name="applicant_id" value={applicant.id} />
      <h2 className="font-serif text-lg text-ink">Marking scheme -- selection task</h2>
      <p className="text-sm text-muted">Same shape as the Standard of English criterion on the assignment cover sheets.</p>

      <div className="flex flex-col gap-3">
        {ROWS.map((row) => (
          <div key={row.key} className="flex flex-col gap-1.5 border-b border-border-faint pb-3 last:border-none">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`marking_${row.key}`} className="text-sm text-ink">
                {row.label}
              </label>
              <select
                id={`marking_${row.key}`}
                name={`marking_${row.key}`}
                value={values[row.key]}
                onChange={(e) => setValues((v) => ({ ...v, [row.key]: e.target.value }))}
                className="h-8 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink"
              >
                <option value="">Not marked</option>
                <option value="above">Above standard</option>
                <option value="at">At standard</option>
                <option value="below">Below standard</option>
              </select>
            </div>
            {values[row.key] === "below" ? (
              <input
                type="text"
                name={`marking_${row.key}_note`}
                placeholder="Note required for a Below standard mark"
                required
                defaultValue={(applicant[`marking_${row.key}_note` as keyof Applicant] as string | null) ?? ""}
                className="rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
              />
            ) : null}
          </div>
        ))}
      </div>

      {/*
        The tutor's words about the task, carried into whichever email goes out
        -- offer or rejection -- and shown in the application file the assessor
        reads. Sits here because this is the moment someone has actually read
        the work.

        The AI suggestion appears above it, clearly labelled and never
        pre-filled into the box: "AI will only flag it out, and then the
        trainer would take a look at it and then make a decision" (Ramy,
        2026-08-16). Copying it in would make accepting it the path of least
        resistance, which is exactly what "never generated" is meant to
        prevent.
      */}
      <div className="flex flex-col gap-1.5 border-t border-border-faint pt-4">
        <label htmlFor="task_feedback" className="text-sm text-ink">
          What to say about their task
        </label>
        <p className="text-xs text-muted">
          Your words, in the offer or the rejection, and in the application file. Never sent unedited.
        </p>

        {applicant.task_feedback_ai_suggestion ? (
          <div className="mt-1 rounded-[6px] border border-border bg-surface-muted p-3">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Suggested — not sent</p>
            <p className="mt-1 text-sm text-ink">{applicant.task_feedback_ai_suggestion}</p>
          </div>
        ) : null}

        <textarea
          id="task_feedback"
          name="task_feedback"
          rows={4}
          defaultValue={applicant.task_feedback ?? ""}
          placeholder="Strong on organisation and substance. Both analysis items were left blank, and that is worth attention early."
          className="mt-1 rounded-[6px] border border-input bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save marking"}
      </button>
    </form>
  );
}
