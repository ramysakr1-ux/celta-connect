"use client";

import { useActionState, useState } from "react";
import {
  updateStage2Ratings,
  updateStage3Ratings,
  type FormState,
} from "@/app/dashboard/trainer/celta5-actions";
import { CELTA_CRITERIA_SECTIONS, CRITERIA_LABELS, CRITERIA_GUIDANCE } from "@/lib/celta-criteria";
import { CriteriaRatingPill } from "@/lib/status-pill";
import { CriteriaRatingPills } from "@/components/criteria-rating-pills";
import type { Database } from "@/lib/supabase/types";

type MatrixRow = Database["public"]["Tables"]["celta5_matrix"]["Row"];

const initialState: FormState = { error: null };
const TOTAL_CODES = CELTA_CRITERIA_SECTIONS.reduce((n, s) => n + s.codes.length, 0);

export function StageRatingsForm({
  stage,
  traineeId,
  rows,
  suggestions = {},
}: {
  stage: 2 | 3;
  traineeId: string;
  rows: MatrixRow[];
  suggestions?: Record<string, "S+" | "S" | "N">;
}) {
  const action = stage === 2 ? updateStage2Ratings : updateStage3Ratings;
  const [state, formAction, pending] = useActionState(action, initialState);
  const byCode = new Map(rows.map((r) => [r.criteria_code, r]));

  // Ratings start from what's already saved -- NOT the suggestion. A
  // suggestion is offered separately and only becomes "your rating" once
  // explicitly accepted (one click, or via "Accept all"), per the design
  // reference's own rule: "the suggestion itself never counts as an
  // assessment."
  const [ratings, setRatings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [code, row] of byCode) {
      const tutorStatus = stage === 2 ? row.tutor_status_stage2 : row.tutor_status_stage3;
      if (tutorStatus) initial[code] = tutorStatus;
    }
    return initial;
  });

  const ratedCount = Object.values(ratings).filter(Boolean).length;
  const unacceptedSuggestions = Object.keys(suggestions).filter((code) => !ratings[code]);

  function acceptAllSuggestions() {
    setRatings((prev) => {
      const next = { ...prev };
      for (const code of unacceptedSuggestions) next[code] = suggestions[code];
      return next;
    });
  }

  return (
    <form action={formAction} className="sheet flex flex-col gap-6 p-6">
      <input type="hidden" name="trainee_id" value={traineeId} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-[6px] bg-accent px-2.5 py-1 text-xs font-medium text-ink">
          Tutor: {ratedCount} of {TOTAL_CODES}
        </span>
        {unacceptedSuggestions.length > 0 ? (
          <button
            type="button"
            onClick={acceptAllSuggestions}
            className="rounded-[6px] border border-dashed border-gold px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/10"
          >
            Accept all suggestions ({unacceptedSuggestions.length})
          </button>
        ) : null}
      </div>

      {CELTA_CRITERIA_SECTIONS.map(({ section, title, codes }) => (
        <div key={section} className="flex flex-col gap-4">
          <h3 className="font-serif text-ink">
            Topic {section} -- {title}
          </h3>
          {codes.map((code) => {
            const row = byCode.get(code);
            const candidateStatus = row?.candidate_status ?? null;
            const value = ratings[code] ?? "";
            const suggestion = suggestions[code];
            const showSuggestion = !!suggestion && !value;
            const disagrees = !!candidateStatus && !!value && candidateStatus !== value;

            return (
              <div key={code} className="border-b border-border-faint pb-4 last:border-none">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-ink">
                    {code}
                    {CRITERIA_LABELS[code] ? ` -- ${CRITERIA_LABELS[code]}` : ""}
                    {disagrees ? (
                      <span className="ml-2 text-sm font-semibold text-gold" title="Candidate and tutor ratings differ">
                        &ne;
                      </span>
                    ) : null}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted">Candidate:</span>
                    <CriteriaRatingPill rating={candidateStatus} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input type="hidden" name={`status__${code}`} value={value} />
                  <span className="text-xs text-muted">Your rating:</span>
                  <CriteriaRatingPills value={value} onChange={(v) => setRatings((prev) => ({ ...prev, [code]: v }))} />
                  {showSuggestion ? (
                    <button
                      type="button"
                      onClick={() => setRatings((prev) => ({ ...prev, [code]: suggestion }))}
                      className="rounded-[6px] border border-dashed border-gold px-2 py-1 text-xs font-medium text-gold hover:bg-gold/10"
                      title="Suggested from TP notes -- click to accept as your rating"
                    >
                      Suggested: {suggestion}
                    </button>
                  ) : null}
                </div>
                {CRITERIA_GUIDANCE[code] ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted hover:text-primary">Guidance</summary>
                    <ul className="mt-1 flex flex-col gap-0.5 pl-4 text-xs text-muted">
                      {CRITERIA_GUIDANCE[code].map((bullet, i) => (
                        <li key={i} className="list-disc">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save criteria"}
      </button>
    </form>
  );
}
