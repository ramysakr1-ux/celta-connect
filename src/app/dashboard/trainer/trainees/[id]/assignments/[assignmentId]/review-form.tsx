"use client";

import { useActionState } from "react";
import {
  returnForResubmission,
  returnWithPass,
  type FormState,
} from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/actions";
import { TrainerFeedbackTextarea } from "@/components/trainer-feedback-textarea";
import type { TemplateSection } from "@/lib/assignment-templates/content";

const initialState: FormState = { error: null };
const inputClass =
  "w-full rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary";

interface SectionResponse {
  section_key: string;
  section_title: string;
  first_response: string | null;
  first_comments: string | null;
  resubmission_response: string | null;
  resubmission_comments: string | null;
}

export function AssignmentReviewForm({
  assignmentId,
  sections,
  responses,
  round,
}: {
  assignmentId: string;
  sections: TemplateSection[];
  responses: SectionResponse[];
  round: "first" | "resubmission";
}) {
  const responseByKey = new Map(responses.map((r) => [r.section_key, r]));

  const [passState, passAction, passPending] = useActionState(returnWithPass, initialState);
  const [resubState, resubAction, resubPending] = useActionState(returnForResubmission, initialState);
  const state = passPending ? passState : resubState;

  return (
    <form className="flex flex-col gap-4">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="round" value={round} />
      <input
        type="hidden"
        name="section_keys"
        value={JSON.stringify(sections.map((s) => ({ key: s.key, title: s.title })))}
      />

      {sections.map((s) => {
        const existing = responseByKey.get(s.key);
        const responseText = (round === "resubmission" ? existing?.resubmission_response : existing?.first_response) ?? "";
        const existingComment = (round === "resubmission" ? existing?.resubmission_comments : existing?.first_comments) ?? "";
        return (
          <div key={s.key} className="card p-6">
            <h3 className="font-serif text-lg text-ink">{s.title}</h3>
            <p className="mt-3 whitespace-pre-line text-ink">{responseText || "(no response)"}</p>
            <div className="mt-4 flex flex-col gap-1.5 border-t border-border-faint pt-4">
              <label className="text-sm text-muted">Comment on this section</label>
              <TrainerFeedbackTextarea
                name={`comment_${s.key}`}
                rows={3}
                defaultValue={existingComment}
                className={inputClass}
              />
            </div>
          </div>
        );
      })}

      <div className="card flex flex-col gap-3 p-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Final grade note (only used for &quot;Return with a pass&quot;)</label>
          <input type="text" name="final_grade" placeholder="e.g. Pass" className={inputClass} />
        </div>

        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            formAction={passAction}
            disabled={passPending || resubPending}
            className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
          >
            {passPending ? "Returning…" : "Return with a pass"}
          </button>
          <button
            type="submit"
            formAction={resubAction}
            disabled={passPending || resubPending}
            className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink hover:border-primary disabled:opacity-60"
          >
            {resubPending ? "Returning…" : "Return for resubmission"}
          </button>
        </div>
      </div>
    </form>
  );
}
