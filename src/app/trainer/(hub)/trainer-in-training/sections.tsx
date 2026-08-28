"use client";

import { useActionState } from "react";
import {
  togglePreCourseTask,
  toggleObservedSession,
  unmarkObservedSession,
  addTask12Stage1,
  removeTask12Stage1,
  addDeliveredSession,
  updateDeliveredSessionSelfEval,
  updateDeliveredSessionSupervisorFeedback,
  addFeedbackSession,
  saveFeedbackDraft,
  finalizeFeedbackSession,
  saveFeedbackOnFeedback,
  addCandidateFollowed,
  updateCandidateNotes,
  addShadowMarking,
  updateTaskRecordItem,
  signTaskRecordItem,
  updateReflectiveEssay,
  submitReflectiveEssay,
  updateScheme,
  updateTrainsAtNominatingCentre,
  updateModesTrained,
  bookAssessorDay,
  completeAssessorDay,
  setOutcome,
  submitPortfolio,
  type FormState,
} from "@/app/trainer/(hub)/trainer-in-training/actions";

const initial: FormState = { error: null };
const inputClass = "rounded-[6px] border border-input bg-card px-2.5 py-1.5 text-sm text-ink outline-none focus:border-primary";
const textareaClass = `${inputClass} w-full`;

// Screen 1a's pre-course checklist -- 8 fixed items, ticked as done.
export function PreCourseChecklist({ tasks }: { tasks: { id: string; label: string; completedAt: string | null }[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {tasks.map((t) => (
        <li key={t.id}>
          <form action={togglePreCourseTask}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="checked" value={String(!t.completedAt)} />
            <button type="submit" className="flex w-full items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-left text-sm hover:bg-surface-muted">
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded border ${t.completedAt ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
              >
                {t.completedAt ? "✓" : ""}
              </span>
              <span className={t.completedAt ? "text-muted line-through" : "text-ink"}>{t.label}</span>
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

export function SchemeAndModesForm({
  titRecordId,
  scheme,
  modesTrained,
  trainsAtNominatingCentre,
}: {
  titRecordId: string;
  scheme: "internal" | "external";
  modesTrained: string[];
  trainsAtNominatingCentre: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <form action={updateScheme} className="flex items-center gap-2">
        <input type="hidden" name="tit_record_id" value={titRecordId} />
        <label className="text-xs text-muted">Scheme</label>
        <select name="scheme" defaultValue={scheme} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={inputClass}>
          <option value="internal">Internal</option>
          <option value="external">External</option>
        </select>
      </form>
      {scheme === "internal" ? (
        <form action={updateTrainsAtNominatingCentre} className="flex items-center gap-1.5">
          <input type="hidden" name="tit_record_id" value={titRecordId} />
          <label className="flex items-center gap-1.5 text-sm text-ink">
            <input
              type="checkbox"
              name="trains_at_nominating_centre"
              defaultChecked={trainsAtNominatingCentre}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
            Trains at the nominating centre
          </label>
        </form>
      ) : null}
      <form action={updateModesTrained} className="flex items-center gap-3">
        <input type="hidden" name="tit_record_id" value={titRecordId} />
        <label className="text-xs text-muted">Modes trained in</label>
        {(["f2f", "online"] as const).map((m) => (
          <label key={m} className="flex items-center gap-1.5 text-sm text-ink">
            <input
              type="checkbox"
              name="modes"
              value={m}
              defaultChecked={modesTrained.includes(m)}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            />
            {m === "f2f" ? "Face-to-face" : "Online"}
          </label>
        ))}
      </form>
    </div>
  );
}

export function ObservedSessionRow({
  titRecordId,
  event,
  observedId,
  asynchronous,
  showAsync,
}: {
  titRecordId: string;
  event: { id: string; title: string; event_date: string };
  observedId: string | null;
  asynchronous: boolean;
  showAsync: boolean;
}) {
  const [state, action, pending] = useActionState(toggleObservedSession, initial);
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{event.title}</p>
        <p className="text-xs text-muted">{event.event_date}</p>
      </div>
      {observedId ? (
        <div className="flex items-center gap-2">
          {showAsync && asynchronous ? <span className="pill pill-neutral">Async</span> : null}
          <span className="pill pill-success">Observed</span>
          <form action={unmarkObservedSession}>
            <input type="hidden" name="id" value={observedId} />
            <button type="submit" className="text-xs text-muted hover:text-destructive">
              Undo
            </button>
          </form>
        </div>
      ) : (
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="tit_record_id" value={titRecordId} />
          <input type="hidden" name="timetable_event_id" value={event.id} />
          {showAsync ? (
            <label className="flex items-center gap-1 text-xs text-muted">
              <input type="checkbox" name="asynchronous" /> Async
            </label>
          ) : null}
          <button type="submit" disabled={pending} className="text-xs font-semibold text-primary hover:underline disabled:opacity-60">
            Mark observed
          </button>
        </form>
      )}
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </div>
  );
}

export function Task12Stage1Form({ titRecordId, events }: { titRecordId: string; events: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(addTask12Stage1, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tit_record_id" value={titRecordId} />
      <select name="timetable_event_id" defaultValue="" className={inputClass}>
        <option value="">Which session (optional)</option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
          </option>
        ))}
      </select>
      <input name="handout_description" placeholder="What did you prepare?" className={`${inputClass} min-w-[220px] flex-1`} />
      <button type="submit" disabled={pending} className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">
        {pending ? "Saving…" : "File it"}
      </button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function Task12Stage1List({ rows }: { rows: { id: string; eventTitle: string | null; handoutDescription: string; filedAt: string }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">Nothing filed yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-3 rounded-[6px] bg-surface-muted/50 px-3 py-2">
          <div>
            <p className="text-sm text-ink">{r.handoutDescription}</p>
            <p className="text-xs text-muted">{r.eventTitle ? `${r.eventTitle} · ` : ""}{new Date(r.filedAt).toLocaleDateString("en-GB")}</p>
          </div>
          <form action={removeTask12Stage1}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" className="text-xs text-muted hover:text-destructive">
              Remove
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

export function AddDeliveredSessionForm({ titRecordId }: { titRecordId: string }) {
  const [state, action, pending] = useActionState(addDeliveredSession, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tit_record_id" value={titRecordId} />
      <input name="title" placeholder="Session title -- your own design" className={`${inputClass} min-w-[220px] flex-1`} required />
      <input name="delivered_at" type="date" className={inputClass} required />
      <button type="submit" disabled={pending} className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function DeliveredSessionCard({
  row,
}: {
  row: {
    id: string;
    title: string;
    deliveredAt: string;
    selfEvaluation: string | null;
    selfEvaluationAt: string | null;
    supervisorFeedback: string | null;
    supervisorFeedbackAt: string | null;
  };
}) {
  const [selfState, selfAction, selfPending] = useActionState(updateDeliveredSessionSelfEval, initial);
  const [fbState, fbAction, fbPending] = useActionState(updateDeliveredSessionSupervisorFeedback, initial);
  return (
    <div className="rounded-[6px] border border-border p-3">
      <p className="text-sm font-semibold text-ink">{row.title}</p>
      <p className="text-xs text-muted">{row.deliveredAt}</p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Your self-evaluation</p>
          {row.selfEvaluation ? (
            <p className="mt-1 text-xs whitespace-pre-wrap text-ink">{row.selfEvaluation}</p>
          ) : (
            <form action={selfAction} className="mt-1 flex flex-col gap-1.5">
              <input type="hidden" name="id" value={row.id} />
              <textarea name="self_evaluation" rows={3} placeholder="Strengths, and what to develop" className={textareaClass} />
              <button type="submit" disabled={selfPending} className="self-start rounded-[6px] border border-border px-2.5 py-1 text-xs font-semibold text-ink trainer-hover-fill disabled:opacity-60">
                {selfPending ? "Saving…" : "Save"}
              </button>
              {selfState.error ? <p className="text-xs text-destructive">{selfState.error}</p> : null}
            </form>
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Supervisor&apos;s feedback</p>
          {row.supervisorFeedback ? (
            <p className="mt-1 text-xs whitespace-pre-wrap text-ink">{row.supervisorFeedback}</p>
          ) : (
            <form action={fbAction} className="mt-1 flex flex-col gap-1.5">
              <input type="hidden" name="id" value={row.id} />
              <textarea name="supervisor_feedback" rows={3} placeholder="Written feedback on this specific session" className={textareaClass} />
              <button type="submit" disabled={fbPending} className="self-start rounded-[6px] border border-border px-2.5 py-1 text-xs font-semibold text-ink trainer-hover-fill disabled:opacity-60">
                {fbPending ? "Saving…" : "Save"}
              </button>
              {fbState.error ? <p className="text-xs text-destructive">{fbState.error}</p> : null}
            </form>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted">Neither document is countersigned or shown to candidates.</p>
    </div>
  );
}

export function AddFeedbackSessionForm({ titRecordId, trainees }: { titRecordId: string; trainees: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addFeedbackSession, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tit_record_id" value={titRecordId} />
      <select name="trainee_id" defaultValue="" className={inputClass}>
        <option value="">Candidate (optional)</option>
        {trainees.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input name="tp_number" type="number" min={1} max={8} placeholder="TP #" className={`${inputClass} w-20`} />
      <input name="conducted_at" type="date" className={inputClass} required />
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" name="observed_by_supervisor" /> Supervisor observed
      </label>
      <button type="submit" disabled={pending} className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function FeedbackSessionCard({
  row,
}: {
  row: {
    id: string;
    traineeName: string | null;
    tpNumber: number | null;
    conductedAt: string;
    observedBySupervisor: boolean;
    privateDraft: string | null;
    supervisorDiscussionNotes: string | null;
    finalizedAt: string | null;
    feedbackOnFeedbackNotes: string | null;
    feedbackOnFeedbackAt: string | null;
  };
}) {
  const [draftState, draftAction, draftPending] = useActionState(saveFeedbackDraft, initial);
  const [finalState, finalAction, finalPending] = useActionState(finalizeFeedbackSession, initial);
  const [fofState, fofAction, fofPending] = useActionState(saveFeedbackOnFeedback, initial);

  return (
    <div className="rounded-[6px] border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">
          {row.traineeName ?? "Unnamed candidate"}
          {row.tpNumber ? ` · TP${row.tpNumber}` : ""}
        </p>
        <span className="text-xs text-muted">{row.conductedAt}{row.observedBySupervisor ? " · supervisor observed" : ""}</span>
      </div>

      <div className="mt-2">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Your private draft assessment (Task 13)</p>
        <p className="text-[11px] text-muted">Written before seeing the supervisor&apos;s own view. Never reaches the candidate.</p>
        {row.privateDraft ? (
          <p className="mt-1 text-xs whitespace-pre-wrap text-ink">{row.privateDraft}</p>
        ) : (
          <form action={draftAction} className="mt-1 flex flex-col gap-1.5">
            <input type="hidden" name="id" value={row.id} />
            <textarea name="private_draft" rows={3} className={textareaClass} />
            <button type="submit" disabled={draftPending} className="self-start rounded-[6px] border border-border px-2.5 py-1 text-xs font-semibold text-ink trainer-hover-fill disabled:opacity-60">
              {draftPending ? "Saving…" : "Save draft"}
            </button>
            {draftState.error ? <p className="text-xs text-destructive">{draftState.error}</p> : null}
          </form>
        )}
      </div>

      {row.privateDraft && !row.finalizedAt ? (
        <form action={finalAction} className="mt-2 flex flex-col gap-1.5 border-t border-border-faint pt-2">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Discuss with your supervisor</p>
          <input type="hidden" name="id" value={row.id} />
          <textarea name="supervisor_discussion_notes" rows={2} placeholder="What the discussion covered" className={textareaClass} />
          <button type="submit" disabled={finalPending} className="self-start rounded-[6px] border border-border px-2.5 py-1 text-xs font-semibold text-ink trainer-hover-fill disabled:opacity-60">
            {finalPending ? "Saving…" : "Mark discussed"}
          </button>
          {finalState.error ? <p className="text-xs text-destructive">{finalState.error}</p> : null}
        </form>
      ) : row.finalizedAt ? (
        <div className="mt-2 border-t border-border-faint pt-2">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Discussion</p>
          <p className="mt-1 text-xs whitespace-pre-wrap text-ink">{row.supervisorDiscussionNotes}</p>
        </div>
      ) : null}

      <div className="mt-2 border-t border-border-faint pt-2">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Feedback on how you gave feedback</p>
        <p className="text-[11px] text-muted">Not what it said -- how you delivered it. Private, discussed straight after.</p>
        {row.feedbackOnFeedbackNotes ? (
          <p className="mt-1 text-xs whitespace-pre-wrap text-ink">{row.feedbackOnFeedbackNotes}</p>
        ) : (
          <form action={fofAction} className="mt-1 flex flex-col gap-1.5">
            <input type="hidden" name="id" value={row.id} />
            <textarea name="feedback_on_feedback_notes" rows={2} className={textareaClass} />
            <button type="submit" disabled={fofPending} className="self-start rounded-[6px] border border-border px-2.5 py-1 text-xs font-semibold text-ink trainer-hover-fill disabled:opacity-60">
              {fofPending ? "Saving…" : "Save"}
            </button>
            {fofState.error ? <p className="text-xs text-destructive">{fofState.error}</p> : null}
          </form>
        )}
      </div>
    </div>
  );
}

export function AddCandidateFollowedForm({ titRecordId, trainees }: { titRecordId: string; trainees: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addCandidateFollowed, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tit_record_id" value={titRecordId} />
      <select name="trainee_id" defaultValue="" className={inputClass} required>
        <option value="" disabled>
          Choose a candidate
        </option>
        {trainees.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">
        {pending ? "Adding…" : "Follow"}
      </button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

function CandidateNoteField({ id, stage, label, value }: { id: string; stage: "beginning" | "middle" | "end"; label: string; value: string | null }) {
  const [state, action, pending] = useActionState(updateCandidateNotes, initial);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="stage" value={stage} />
      <label className="text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">{label}</label>
      <textarea name="notes" defaultValue={value ?? ""} rows={2} className={textareaClass} />
      <button type="submit" disabled={pending} className="self-start text-xs font-semibold text-primary hover:underline disabled:opacity-60">
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function CandidateFollowedCard({
  row,
}: {
  row: { id: string; traineeName: string; notesBeginning: string | null; notesMiddle: string | null; notesEnd: string | null };
}) {
  return (
    <div className="rounded-[6px] border border-border p-3">
      <p className="text-sm font-semibold text-ink">{row.traineeName}</p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CandidateNoteField id={row.id} stage="beginning" label="Beginning" value={row.notesBeginning} />
        <CandidateNoteField id={row.id} stage="middle" label="Middle" value={row.notesMiddle} />
        <CandidateNoteField id={row.id} stage="end" label="End" value={row.notesEnd} />
      </div>
    </div>
  );
}

export function AddShadowMarkingForm({ titRecordId, assignments }: { titRecordId: string; assignments: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(addShadowMarking, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tit_record_id" value={titRecordId} />
      <select name="assignment_id" defaultValue="" className={inputClass}>
        <option value="">Which assignment (optional)</option>
        {assignments.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
      <input name="tit_grade" placeholder="Your grade" className={`${inputClass} w-28`} />
      <input name="supervisor_grade" placeholder="Supervisor's grade" className={`${inputClass} w-32`} />
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" name="agreed" /> Agreed
      </label>
      <button type="submit" disabled={pending} className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function ShadowMarkingList({
  rows,
}: {
  rows: { id: string; assignmentLabel: string | null; titGrade: string | null; supervisorGrade: string | null; agreed: boolean | null; markedAt: string }[];
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">No shadow marking recorded yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 rounded-[6px] bg-surface-muted/50 px-3 py-2 text-sm">
          <span className="text-ink">{r.assignmentLabel ?? "Assignment"}</span>
          <span className="text-xs text-muted">
            You: {r.titGrade ?? "--"} · Supervisor: {r.supervisorGrade ?? "--"}
          </span>
          <span className={`pill ${r.agreed ? "pill-success" : "pill-neutral"}`}>{r.agreed ? "Agreed" : "Not recorded"}</span>
        </li>
      ))}
    </ul>
  );
}

export function TaskRecordItemRow({
  row,
}: {
  row: { id: string; itemNumber: number; label: string; titSignedAt: string | null; supervisorSignedAt: string | null };
}) {
  const [state, action, pending] = useActionState(updateTaskRecordItem, initial);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-faint py-1.5 last:border-none">
      <span className="w-6 shrink-0 text-xs tabular-nums text-muted">{row.itemNumber}</span>
      {row.label ? (
        <span className="min-w-[160px] flex-1 text-sm text-ink">{row.label}</span>
      ) : (
        <form action={action} className="flex min-w-[220px] flex-1 items-center gap-1.5">
          <input type="hidden" name="id" value={row.id} />
          <input name="label" placeholder="Name this task" className={`${inputClass} flex-1`} />
          <button type="submit" disabled={pending} className="text-xs font-semibold text-primary hover:underline disabled:opacity-60">
            Save
          </button>
        </form>
      )}
      <div className="ml-auto flex items-center gap-2">
        {row.titSignedAt ? (
          <span className="pill pill-success">You signed</span>
        ) : (
          <form action={signTaskRecordItem}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="who" value="tit" />
            <button type="submit" className="text-xs text-primary hover:underline">
              Sign (you)
            </button>
          </form>
        )}
        {row.supervisorSignedAt ? (
          <span className="pill pill-success">Supervisor signed</span>
        ) : (
          <form action={signTaskRecordItem}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="who" value="supervisor" />
            <button type="submit" className="text-xs text-primary hover:underline">
              Sign (supervisor)
            </button>
          </form>
        )}
      </div>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </div>
  );
}

export function ReflectiveEssayForm({ titRecordId, essay, submittedAt }: { titRecordId: string; essay: string | null; submittedAt: string | null }) {
  const [saveState, saveAction, savePending] = useActionState(updateReflectiveEssay, initial);
  const [submitState, submitAction, submitPending] = useActionState(submitReflectiveEssay, initial);
  const wordCount = (essay ?? "").trim().split(/\s+/).filter(Boolean).length;

  if (submittedAt) {
    return (
      <div>
        <p className="text-sm text-ink">Submitted {new Date(submittedAt).toLocaleDateString("en-GB")}.</p>
        <p className="mt-2 text-sm whitespace-pre-wrap text-ink">{essay}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-muted">1,500-2,000 words -- the one compulsory task in the whole programme.</p>
      {/* One form, two submit buttons -- each button's own formAction
          overrides which server action reads this same FormData, so
          "submit" always sees whatever is currently in the textarea
          without reaching into the DOM by hand. */}
      <form className="flex flex-col gap-2">
        <input type="hidden" name="tit_record_id" value={titRecordId} />
        <textarea name="reflective_essay" defaultValue={essay ?? ""} rows={10} className={textareaClass} />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            formAction={saveAction}
            disabled={savePending}
            className="rounded-[6px] border border-border px-3 py-1.5 text-xs font-semibold text-ink trainer-hover-fill disabled:opacity-60"
          >
            {savePending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="submit"
            formAction={submitAction}
            disabled={submitPending}
            className="rounded-[6px] bg-ink-warm px-3 py-1.5 text-xs font-semibold text-card hover:bg-ink-warm/90 disabled:opacity-60"
          >
            {submitPending ? "Submitting…" : "Submit final essay"}
          </button>
          <span className="text-xs tabular-nums text-muted">{wordCount} words</span>
        </div>
        {saveState.error ? <p className="text-xs text-destructive">{saveState.error}</p> : null}
        {submitState.error ? <p className="text-xs text-destructive">{submitState.error}</p> : null}
      </form>
    </div>
  );
}

export function AssessorDayCard({ titRecordId, bookedAt, completedAt }: { titRecordId: string; bookedAt: string | null; completedAt: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">
        Book this when the course assessment itself is booked, not discovered afterwards. Connect prepares the day and the
        portfolio; it never produces or holds the Assessor Moderation Report.
      </p>
      <div className="flex items-center gap-3">
        {bookedAt ? (
          <span className="pill pill-success">Booked {new Date(bookedAt).toLocaleDateString("en-GB")}</span>
        ) : (
          <form action={bookAssessorDay}>
            <input type="hidden" name="tit_record_id" value={titRecordId} />
            <button type="submit" className="rounded-[6px] border border-border px-3 py-1.5 text-xs font-semibold text-ink trainer-hover-fill">
              Mark booked
            </button>
          </form>
        )}
        {bookedAt && !completedAt ? (
          <form action={completeAssessorDay}>
            <input type="hidden" name="tit_record_id" value={titRecordId} />
            <button type="submit" className="rounded-[6px] border border-border px-3 py-1.5 text-xs font-semibold text-ink trainer-hover-fill">
              Mark completed
            </button>
          </form>
        ) : completedAt ? (
          <span className="pill pill-success">Completed {new Date(completedAt).toLocaleDateString("en-GB")}</span>
        ) : null}
      </div>
    </div>
  );
}

export function OutcomeForm({ titRecordId, outcome, note }: { titRecordId: string; outcome: string | null; note: string | null }) {
  const [state, action, pending] = useActionState(setOutcome, initial);
  if (outcome) {
    const label = outcome === "confirmed_act" ? "Confirmed as Assistant Course Tutor" : outcome === "extended" ? "Training extended" : "Not verified";
    return (
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        {outcome === "confirmed_act" ? (
          <p className="mt-1 text-xs text-muted">Not yet Main Course Tutor -- that needs two further courses as ACT plus shadowing an MCT.</p>
        ) : null}
        {note ? <p className="mt-1 text-xs whitespace-pre-wrap text-muted">{note}</p> : null}
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="tit_record_id" value={titRecordId} />
      <p className="text-xs text-muted">Always discussed with the TinT and supervisor first -- this just records what was decided.</p>
      <select name="outcome" defaultValue="" required className={inputClass}>
        <option value="" disabled>
          Choose an outcome
        </option>
        <option value="confirmed_act">Confirmed as Assistant Course Tutor</option>
        <option value="extended">Training extended</option>
        <option value="not_verified">Not verified</option>
      </select>
      <textarea name="outcome_note" rows={2} placeholder="Note (optional)" className={textareaClass} />
      <button type="submit" disabled={pending} className="self-start rounded-[6px] bg-ink-warm px-3 py-1.5 text-xs font-semibold text-card hover:bg-ink-warm/90 disabled:opacity-60">
        {pending ? "Saving…" : "Record outcome"}
      </button>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function SubmitPortfolioButton({ titRecordId, submittedAt }: { titRecordId: string; submittedAt: string | null }) {
  if (submittedAt) {
    return <span className="pill pill-success">Submitted {new Date(submittedAt).toLocaleDateString("en-GB")}</span>;
  }
  return (
    <form action={submitPortfolio}>
      <input type="hidden" name="tit_record_id" value={titRecordId} />
      <button type="submit" className="rounded-[6px] bg-ink-warm px-4 py-2 text-sm font-semibold text-card hover:bg-ink-warm/90">
        Submit portfolio and journal
      </button>
    </form>
  );
}
