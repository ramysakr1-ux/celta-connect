"use client";

import { useActionState } from "react";
import {
  submitStage2SelfAssessment,
  type FormState,
} from "@/app/dashboard/trainee/actions";
import { CELTA_CRITERIA_SECTIONS, CRITERIA_LABELS, CRITERIA_RATING_OPTIONS, STANDARD_RATING_OPTIONS } from "@/lib/celta-criteria";
import { VoiceTextarea } from "@/components/voice-textarea";

const initialState: FormState = { error: null };

export function SelfAssessmentForm() {
  const [state, action, pending] = useActionState(submitStage2SelfAssessment, initialState);

  return (
    <form action={action} className="card flex flex-col gap-6 p-6">
      <div>
        <h2 className="font-serif text-lg text-ink">Stage Two self-assessment</h2>
        <p className="mt-1 text-sm text-muted">
          Rate yourself on each criterion before your tutorial. Your tutor&apos;s ratings
          stay hidden until you submit this.
        </p>
      </div>

      {CELTA_CRITERIA_SECTIONS.map(({ section, title, codes }) => (
        <div key={section} className="flex flex-col gap-4">
          <h3 className="font-serif text-ink">
            Topic {section} -- {title}
          </h3>
          {codes.map((code) => (
            <div key={code} className="flex items-center justify-between gap-4 border-b border-border-faint pb-3 last:border-none">
              <span className="text-sm text-ink">
                {code}
                {CRITERIA_LABELS[code] ? ` -- ${CRITERIA_LABELS[code]}` : ""}
              </span>
              <select
                name={`status__${code}`}
                required
                defaultValue=""
                className="shrink-0 rounded-[6px] border border-border bg-card px-2 py-1 text-sm text-ink outline-none focus:border-primary"
              >
                <option value="" disabled>
                  Rate
                </option>
                {CRITERIA_RATING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Your overall progress</label>
        <select
          name="overall"
          required
          defaultValue=""
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        >
          <option value="" disabled>
            Choose one
          </option>
          {STANDARD_RATING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Areas you think you need to work on</label>
        <VoiceTextarea
          name="notes"
          rows={3}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Written assignments -- anything to raise?</label>
        <VoiceTextarea
          name="written_assignments_notes"
          rows={2}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Other -- attendance, workload, support needs</label>
        <VoiceTextarea
          name="other_notes"
          rows={2}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 font-medium text-card disabled:opacity-60"
      >
        {pending ? "Submitting..." : "Submit self-assessment"}
      </button>
    </form>
  );
}
