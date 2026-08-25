"use client";

import { useActionState, useState } from "react";
import { saveFeedbackDraft, submitFeedback, type FormState } from "@/app/dashboard/trainer/trainees/[id]/tp/[tpNumber]/actions";
import { FeedbackPointEditor } from "@/app/dashboard/trainer/trainees/[id]/tp/[tpNumber]/feedback-point-editor";
import { deleteCaptureNote } from "@/app/trainer/(hub)/capture/actions";
import { FormSubmitBar } from "@/components/form-submit-bar";
import { TutorToneTextarea } from "@/components/tutor-tone-textarea";
import { STANDARD_RATING_OPTIONS, CRITERIA_LABELS } from "@/lib/celta-criteria";
import { StandardRatingPill } from "@/lib/status-pill";
import type { FeedbackPoint } from "@/lib/tp-plan-content";
import type { Database } from "@/lib/supabase/types";

type TpFeedback = Database["public"]["Tables"]["tp_feedback"]["Row"];
type SelfEvaluation = Database["public"]["Tables"]["tp_self_evaluations"]["Row"];
type CaptureNote = { id: string; text: string; criteria_codes: string[]; captured_at: string };

const initialState: FormState = { error: null };
const inputClass =
  "w-full rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary";

const SELF_EVAL_QUOTE_FIELDS: { key: keyof SelfEvaluation; label: string }[] = [
  { key: "what_went_well", label: "What went to plan?" },
  { key: "what_not_as_planned", label: "What didn't go as planned" },
  { key: "next_tp_focus", label: "Focus for next TP" },
];

export function FeedbackForm({
  planId,
  traineeId,
  tpNumber,
  feedback,
  selfEvaluation,
  autoTagEnabled = true,
  toneAssistEnabled = false,
  captureNotes = [],
}: {
  planId: string;
  traineeId: string;
  tpNumber: number;
  feedback: TpFeedback | null;
  selfEvaluation?: SelfEvaluation | null;
  autoTagEnabled?: boolean;
  toneAssistEnabled?: boolean;
  captureNotes?: CaptureNote[];
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
  const [notes, setNotes] = useState<CaptureNote[]>(captureNotes);

  // Adds the captured note straight into the chosen array (as a real,
  // already-tagged FeedbackPoint -- same shape typing one manually would
  // produce) and removes the scratch capture row, since it's now living in
  // the real feedback draft instead. Optimistic on the list (removes
  // immediately); the delete itself just needs to not be lost if it fails,
  // not block the UI on a round trip.
  function pullInNote(note: CaptureNote, target: (points: FeedbackPoint[]) => void, current: FeedbackPoint[]) {
    target([...current, { text: note.text, criteria_codes: note.criteria_codes, starred: false }]);
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    const fd = new FormData();
    fd.set("note_id", note.id);
    fd.set("trainee_id", traineeId);
    fd.set("tp_number", String(tpNumber));
    deleteCaptureNote(fd);
  }

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
        <input type="hidden" name="grade" value={grade} />
        <div className="flex flex-wrap gap-2">
          {STANDARD_RATING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGrade(opt.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                grade === opt.value
                  ? "border-primary bg-primary text-card"
                  : "border-border text-ink hover:border-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {notes.length > 0 ? (
        <div className="rounded-[6px] border border-dashed border-border bg-muted/10 p-4">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Captured during the lesson</p>
          <p className="mt-1 text-xs text-muted">Pulling one in removes it from here and drops it, already tagged, into the section you choose.</p>
          <ul className="mt-3 flex flex-col gap-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-[6px] border border-border-faint bg-card p-3">
                <p className="text-xs text-muted">{new Date(note.captured_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                <p className="mt-1 text-sm text-ink">{note.text}</p>
                {note.criteria_codes.length > 0 ? (
                  <p className="mt-1.5 flex flex-wrap gap-1">
                    {note.criteria_codes.map((code) => (
                      <span key={code} className="badge-solid" title={CRITERIA_LABELS[code] ?? ""}>
                        {code}
                      </span>
                    ))}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => pullInNote(note, setStrengthsTeaching, strengthsTeaching)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink hover:border-primary"
                  >
                    + Strength (teaching)
                  </button>
                  <button
                    type="button"
                    onClick={() => pullInNote(note, setActionPointsTeaching, actionPointsTeaching)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink hover:border-primary"
                  >
                    + Action point (teaching)
                  </button>
                  <button
                    type="button"
                    onClick={() => pullInNote(note, setStrengthsPlanning, strengthsPlanning)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink hover:border-primary"
                  >
                    + Strength (planning)
                  </button>
                  <button
                    type="button"
                    onClick={() => pullInNote(note, setActionPointsPlanning, actionPointsPlanning)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink hover:border-primary"
                  >
                    + Action point (planning)
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Planning</p>
          <FeedbackPointEditor
            label="Strengths in planning"
            guide="One point per line. Tag each with the planning criteria it shows."
            points={strengthsPlanning}
            onChange={setStrengthsPlanning}
            scope="planning"
            starable={false}
            autoTagEnabled={autoTagEnabled}
            toneAssistEnabled={toneAssistEnabled}
          />
          <FeedbackPointEditor
            label="Action points in planning"
            guide="Star the ones you want them to prioritise in the next TP -- starred points carry into the Personal Aims of their next plan."
            points={actionPointsPlanning}
            onChange={setActionPointsPlanning}
            scope="planning"
            starable
            autoTagEnabled={autoTagEnabled}
            toneAssistEnabled={toneAssistEnabled}
          />
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Teaching</p>
          <FeedbackPointEditor
            label="Strengths in teaching"
            guide="What happened in the room -- rapport, clarity, management, language work."
            points={strengthsTeaching}
            onChange={setStrengthsTeaching}
            scope="teaching"
            starable={false}
            autoTagEnabled={autoTagEnabled}
            toneAssistEnabled={toneAssistEnabled}
          />
          <FeedbackPointEditor
            label="Action points in teaching"
            guide="Star the ones to prioritise next time."
            points={actionPointsTeaching}
            onChange={setActionPointsTeaching}
            scope="teaching"
            starable
            autoTagEnabled={autoTagEnabled}
            toneAssistEnabled={toneAssistEnabled}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Overall comment</label>
        <TutorToneTextarea enabled={toneAssistEnabled} name="overall_comment" rows={4} defaultValue={feedback?.overall_comment ?? ""} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Your comment on their self-evaluation</label>
        <p className="text-xs italic text-muted">Appears at the end of the assembled document. Leave empty if you have nothing to add.</p>
        {selfEvaluation ? (
          <div className="flex flex-col gap-2 rounded-[6px] border border-border-faint bg-background p-3">
            {SELF_EVAL_QUOTE_FIELDS.map((field) => {
              const value = selfEvaluation[field.key] as string | null;
              if (!value) return null;
              return (
                <div key={field.key}>
                  <p className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">{field.label}</p>
                  <p className="text-sm text-ink italic">&ldquo;{value}&rdquo;</p>
                </div>
              );
            })}
          </div>
        ) : null}
        <TutorToneTextarea enabled={toneAssistEnabled} name="self_eval_comment" rows={3} defaultValue={feedback?.self_eval_comment ?? ""} className={inputClass} />
      </div>

      <FormSubmitBar
        warning="Submitting releases this feedback to the trainee -- you won't be able to edit it afterwards."
        draftPending={draftPending}
        submitPending={submitPending}
        onSubmitAction={submitActionFn}
        submitLabel="Submit feedback"
        error={state.error}
      />
    </form>
  );
}
