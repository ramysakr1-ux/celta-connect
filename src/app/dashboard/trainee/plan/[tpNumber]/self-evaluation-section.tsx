import { CRITERIA_LABELS } from "@/lib/celta-criteria";
import { SelfEvaluationForm } from "@/app/dashboard/trainee/plan/[tpNumber]/self-evaluation-form";
import type { FeedbackPoint, SelfEvalActionPoint } from "@/lib/tp-plan-content";
import type { Database } from "@/lib/supabase/types";
import { StandardRatingPill } from "@/lib/status-pill";

type TpPlan = Database["public"]["Tables"]["tp_plans"]["Row"];
type TpSelfEvaluation = Database["public"]["Tables"]["tp_self_evaluations"]["Row"];
type TpFeedback = Database["public"]["Tables"]["tp_feedback"]["Row"];

export function SelfEvaluationSection({
  tpNumber,
  plan,
  taught,
  lessonDate = null,
  selfEvaluation,
  previousActionPoints,
  feedback,
  lessonTitle = null,
  lessonWhen = null,
}: {
  tpNumber: number;
  plan: TpPlan | null;
  taught: boolean;
  /** The day this lesson is taught, already formatted -- named in the locked message. */
  lessonDate?: string | null;
  selfEvaluation: TpSelfEvaluation | null;
  previousActionPoints: string[];
  feedback: TpFeedback | null;
  /** For the garnet identity band on the form. */
  lessonTitle?: string | null;
  lessonWhen?: string | null;
}) {
  if (!plan) {
    return null;
  }

  // Ramy, 12 Sep 2026, walking it: "self-eval is open. I can write my self-eval
  // now, and I haven't submitted my lesson plan yet." The gate only checked
  // that a plan ROW existed -- which it does from the first autosave -- not
  // that it had been handed in. A lesson you have not submitted a plan for is
  // not a lesson you can reflect on having taught.
  if (!plan.submitted_at) {
    return (
      <div className="card rounded-[9px] border-t-[var(--trainee-plum)] p-6">
        <h2 className="font-serif text-lg text-ink">Self-evaluation</h2>
        <p className="mt-2 text-sm text-muted">Opens once you have submitted your lesson plan.</p>
      </div>
    );
  }

  if (!taught) {
    return (
      <div className="card rounded-[9px] border-t-[var(--trainee-plum)] p-6">
        <h2 className="font-serif text-lg text-ink">Self-evaluation</h2>
        {/* Ramy, 12 Sep 2026: "the self-evaluation should unlock when the
            lesson date passes." It used to wait for the tutor to log the
            lesson as taught, which on the feedback path meant waiting for the
            feedback itself -- so the candidate could only reflect after
            reading their tutor's view, and the tutor's own "comment on their
            self-evaluation" box could never be filled on a first pass. The
            CELTA order is: teach, reflect, then be fed back to. */}
        <p className="mt-2 text-sm text-muted">
          {lessonDate
            ? `Opens after you teach this lesson, on ${lessonDate}.`
            : "Opens once you have taught this lesson."}
        </p>
      </div>
    );
  }

  if (!selfEvaluation?.submitted_at) {
    return (
      <SelfEvaluationForm
        planId={plan.id}
        tpNumber={tpNumber}
        selfEvaluation={selfEvaluation}
        previousActionPoints={previousActionPoints}
        lessonTitle={lessonTitle}
        lessonWhen={lessonWhen}
      />
    );
  }

  return (
    <>
      <div className="card rounded-[9px] border-t-[var(--trainee-plum)] p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">Self-evaluation</h2>
          <span className="status-pill status-pill-on-track">Submitted -- locked</span>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <ReadOnlyField label="What went to plan?" value={selfEvaluation.what_went_well} />
          <ReadOnlyField label="What didn't go as planned, and why?" value={selfEvaluation.what_not_as_planned} />
          <ReadOnlyField label="Evidence of learning" value={selfEvaluation.evidence_of_learning} />
          <ReadOnlyField label="What I'd do differently" value={selfEvaluation.what_differently} />
          <ActionPointsReadOnly points={selfEvaluation.action_points} />
          <ReadOnlyField label="Focus for next TP" value={selfEvaluation.next_tp_focus} />
        </div>
      </div>

      {feedback?.submitted_at ? (
        <div className="card rounded-[9px] border-t-[var(--trainee-plum)] p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-ink">Tutor feedback</h2>
            {feedback.grade ? <StandardRatingPill rating={feedback.grade} /> : null}
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <FeedbackPointList label="Strengths in planning" points={feedback.strengths_planning} />
            <FeedbackPointList label="Action points in planning" points={feedback.action_points_planning} />
            <FeedbackPointList label="Strengths in teaching" points={feedback.strengths_teaching} />
            <FeedbackPointList label="Action points in teaching" points={feedback.action_points_teaching} />
            <ReadOnlyField label="Overall comment" value={feedback.overall_comment} />
            <ReadOnlyField label="Comment on your self-evaluation" value={feedback.self_eval_comment} />
          </div>
        </div>
      ) : (
        <div className="card rounded-[9px] border-t-[var(--trainee-plum)] p-6">
          <h2 className="font-serif text-lg text-ink">Tutor feedback</h2>
          <p className="mt-2 text-sm text-muted">Not yet released by your trainer.</p>
        </div>
      )}
    </>
  );
}

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="whitespace-pre-line text-ink">{value}</p>
    </div>
  );
}

function ActionPointsReadOnly({ points }: { points: SelfEvalActionPoint[] }) {
  const withContent = points.filter((p) => p.previous_point || p.what_i_did);
  if (withContent.length === 0) return null;
  return (
    <div>
      <p className="text-sm text-muted">Action points from the last TP</p>
      <div className="mt-1 overflow-x-auto rounded-[6px] border border-border-faint">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-border-faint bg-background p-2 text-left text-xs text-muted">
                Action point set last time
              </th>
              <th className="border-b border-border-faint bg-background p-2 text-left text-xs text-muted">
                What I did about it
              </th>
            </tr>
          </thead>
          <tbody>
            {withContent.map((point, i) => (
              <tr key={i}>
                <td className="border-b border-border-faint p-2 align-top text-ink">
                  {point.carried ? <span className="mr-1 text-xs text-status-warning-text">★</span> : null}
                  {point.previous_point}
                </td>
                <td className="border-b border-border-faint p-2 align-top text-ink">{point.what_i_did}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeedbackPointList({ label, points }: { label: string; points: FeedbackPoint[] }) {
  if (points.length === 0) return null;
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <ul className="mt-1 flex flex-col gap-2">
        {points.map((point, i) => (
          <li key={i} className="text-ink">
            {point.starred ? <span className="mr-1 text-primary">★</span> : null}
            {point.text}
            {point.criteria_codes.length > 0 ? (
              <span className="ml-2 text-xs text-muted">
                (
                {point.criteria_codes
                  .map((code) => `${code}${CRITERIA_LABELS[code] ? ` -- ${CRITERIA_LABELS[code]}` : ""}`)
                  .join("; ")}
                )
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
