"use client";

import { useActionState } from "react";
import {
  updateStage2Ratings,
  updateStage3Ratings,
  type FormState,
} from "@/app/dashboard/trainer/celta5-actions";
import { CELTA_CRITERIA_SECTIONS, CRITERIA_LABELS, CRITERIA_RATING_OPTIONS } from "@/lib/celta-criteria";
import { CriteriaRatingPill } from "@/lib/status-pill";
import type { Database } from "@/lib/supabase/types";

type MatrixRow = Database["public"]["Tables"]["celta5_matrix"]["Row"];

const initialState: FormState = { error: null };

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

  return (
    <form action={formAction} className="card flex flex-col gap-6 p-6">
      <input type="hidden" name="trainee_id" value={traineeId} />

      {CELTA_CRITERIA_SECTIONS.map(({ section, title, codes }) => (
        <div key={section} className="flex flex-col gap-4">
          <h3 className="font-serif text-ink">
            Topic {section} -- {title}
          </h3>
          {codes.map((code) => {
            const row = byCode.get(code);
            const tutorStatus = stage === 2 ? row?.tutor_status_stage2 : row?.tutor_status_stage3;
            const suggestion = suggestions[code];
            const isSuggested = !tutorStatus && !!suggestion;

            return (
              <div key={code} className="border-b border-border-faint pb-4 last:border-none">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-ink">
                    {code}
                    {CRITERIA_LABELS[code] ? ` -- ${CRITERIA_LABELS[code]}` : ""}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted">Candidate:</span>
                    <CriteriaRatingPill rating={row?.candidate_status ?? null} />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted">Tutor:</span>
                  <select
                    name={`status__${code}`}
                    defaultValue={tutorStatus ?? suggestion ?? ""}
                    className="appearance-none rounded-[6px] border border-border bg-card px-2 py-1 text-center text-sm text-ink outline-none focus:border-primary"
                  >
                    <option value="">Not rated</option>
                    {CRITERIA_RATING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {isSuggested ? (
                    <span className="text-xs text-muted">
                      (suggested from TP notes -- review before saving)
                    </span>
                  ) : null}
                </div>
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
