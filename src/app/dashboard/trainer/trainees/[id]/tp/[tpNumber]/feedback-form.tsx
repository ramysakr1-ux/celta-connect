"use client";

import { useActionState, useState } from "react";
import { saveFeedbackDraft, submitFeedback, type FormState } from "@/app/dashboard/trainer/trainees/[id]/tp/[tpNumber]/actions";
import { FeedbackPointEditor } from "@/app/dashboard/trainer/trainees/[id]/tp/[tpNumber]/feedback-point-editor";
import { TrainerFeedbackTextarea } from "@/components/trainer-feedback-textarea";
import { STANDARD_RATING_OPTIONS } from "@/lib/celta-criteria";
import { StandardRatingPill } from "@/lib/status-pill";
import type { FeedbackPoint } from "@/lib/tp-plan-content";
import type { Database } from "@/lib/supabase/types";

type TpFeedback = Database["public"]["Tables"]["tp_feedback"]["Row"];

const initialState: FormState = { error: null };
const inputClass =
  "w-full rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary";

export function FeedbackForm({
  planId,
  traineeId,
  tpNumber,
  feedback,
}: {
  planId: string;
  traineeId: string;
  tpNumber: number;
  feedback: TpFeedback | null;
}) {
  const locked = Boolean(feedback?.submitted_at);
  const [draftState, draftAction, draftPending] = useActionState(saveFeedbackDraft, initialState);
  const [submitState, submitActionFn, submitPending] = useActionState(submitFeedback, initialState);

  const [grade, setGrade] = useState(feedback?.grade ?? "");
  const [strengthsPlanning, setStrengthsPlanning] = useState<FeedbackPoint[]>(feedback?.strengths_planning ?? []);
  const [actionPointsPlanning, setActionPointsPlanning] = useState<FeedbackPoint[]>(
    feedback?.action_points_planning ?? []
  );
  const [strengthsTeaching, setStrengthsTeaching] = useState<FeedbackPoint[]>(feedback?.strengths_teaching ?? []);
  const [actionPointsTeaching, setActionPointsTeaching] = useState<FeedbackPoint[]>(
    feedback?.action_points_teaching ?? []
  );

  const state = submitPending ? submitState : draftState;

  if (locked) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Tutor feedback</h2>
          <span className="status-pill status-pill-on-track">Submitted</span>
        </div>
        {feedback?.grade ? <div className="mt-2"><StandardRatingPill rating={feedback.grade} /></div> : null}
      </div>
    );
  }

  return (
    <form action={draftAction} className="card flex flex-col gap-4 p-6">
      <h2 className="font-serif text-lg text-ink">Tutor feedback</h2>
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="trainee_id" value={traineeId} />
      <input type="hidden" name="tp_number" value={tpNumber} />
      <input type="hidden" name="strengths_planning" value={JSON.stringify(strengthsPlanning)} />
      <input type="hidden" name="action_points_planning" value={JSON.stringify(actionPointsPlanning)} />
      <input type="hidden" name="strengths_teaching" value={JSON.stringify(strengthsTeaching)} />
      <input type="hidden" name="action_points_teaching" value={JSON.stringify(actionPointsTeaching)} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Lesson grade at this stage of the course</label>
        <select name="grade" value={grade} onChange={(e) => setGrade(e.target.value)} className={`${inputClass} max-w-xs`}>
          <option value="">— choose —</option>
          {STANDARD_RATING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <FeedbackPointEditor
        label="Strengths in planning"
        guide="One point per line. Tag each with the planning criteria it shows."
        points={strengthsPlanning}
        onChange={setStrengthsPlanning}
        scope="planning"
        starable={false}
      />
      <FeedbackPointEditor
        label="Action points in planning"
        guide="Star the ones you want them to prioritise in the next TP -- starred points carry into the Personal Aims of their next plan."
        points={actionPointsPlanning}
        onChange={setActionPointsPlanning}
        scope="planning"
        starable
      />
      <FeedbackPointEditor
        label="Strengths in teaching"
        guide="What happened in the room -- rapport, clarity, management, language work."
        points={strengthsTeaching}
        onChange={setStrengthsTeaching}
        scope="teaching"
        starable={false}
      />
      <FeedbackPointEditor
        label="Action points in teaching"
        guide="Star the ones to prioritise next time."
        points={actionPointsTeaching}
        onChange={setActionPointsTeaching}
        scope="teaching"
        starable
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Overall comment</label>
        <TrainerFeedbackTextarea name="overall_comment" rows={4} defaultValue={feedback?.overall_comment ?? ""} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Your comment on their self-evaluation</label>
        <p className="text-xs italic text-muted">Appears at the end of the assembled document. Leave empty if you have nothing to add.</p>
        <TrainerFeedbackTextarea name="self_eval_comment" rows={3} defaultValue={feedback?.self_eval_comment ?? ""} className={inputClass} />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={draftPending || submitPending}
          className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink hover:border-primary disabled:opacity-60"
        >
          {draftPending ? "Saving…" : "Save draft"}
        </button>
        <button
          type="submit"
          formAction={submitActionFn}
          disabled={draftPending || submitPending}
          onClick={(e) => {
            if (!window.confirm("Submitting releases this feedback to the trainee. Continue?")) {
              e.preventDefault();
            }
          }}
          className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
        >
          {submitPending ? "Submitting…" : "Submit feedback"}
        </button>
      </div>
    </form>
  );
}
