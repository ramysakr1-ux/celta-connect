"use client";

import { useActionState } from "react";
import {
  createOrUpdateIndividualTutorialInvite,
  cancelIndividualTutorialInvite,
  type FormState,
} from "@/app/trainer/(hub)/timetable/individual-tutorial-actions";

const initialState: FormState = { error: null };

interface Candidate {
  id: string;
  name: string;
}

interface InviteSummary {
  id: string;
  traineeId: string;
  traineeName: string;
  eventDate: string;
  eventTime: string | null;
  confirmed: boolean;
}

const STAGE_LABEL: Record<"stage1" | "stage3", string> = {
  stage1: "Stage 1",
  stage3: "Stage 3",
};

// Ramy, 2026-08-17: "individualized invites to stage one and to stage
// three tutorials" -- one tutor, one candidate, one time, unlike Stage 2's
// group booking sheet. No slot count, no self-service claim: the trainer
// sets the time directly and the candidate confirms it.
export function IndividualTutorialSection({
  stage,
  candidates,
  invites,
}: {
  stage: "stage1" | "stage3";
  candidates: Candidate[];
  invites: InviteSummary[];
}) {
  const [state, formAction, pending] = useActionState(createOrUpdateIndividualTutorialInvite, initialState);
  const label = STAGE_LABEL[stage];
  const invitedIds = new Set(invites.map((i) => i.traineeId));
  const notYetInvited = candidates.filter((c) => !invitedIds.has(c.id));

  return (
    <div className="sheet flex flex-col gap-4">
      <div>
        <h2 className="font-serif text-lg text-ink">{label} tutorials</h2>
        <p className="mt-1 text-sm text-muted">
          Individual, invite-only -- pick a candidate, a date, and a time. They confirm it from their Today page.
        </p>
      </div>

      {invites.length > 0 ? (
        <div className="flex flex-col gap-1">
          {invites.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-border-faint px-3 py-2 text-sm">
              <span className="text-ink">{i.traineeName}</span>
              <span className="text-xs text-muted">
                {i.eventDate}
                {i.eventTime ? ` · ${i.eventTime.slice(0, 5)}` : ""}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  i.confirmed ? "bg-primary/10 text-primary" : "bg-status-warning-bg text-status-warning-text"
                }`}
              >
                {i.confirmed ? "Confirmed" : "Awaiting confirmation"}
              </span>
              <form action={cancelIndividualTutorialInvite}>
                <input type="hidden" name="invite_id" value={i.id} />
                <button type="submit" className="shrink-0 text-xs text-muted hover:text-destructive">
                  Cancel
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}

      {candidates.length === 0 ? (
        <p className="text-sm text-muted">No candidates on this course.</p>
      ) : (
        <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input type="hidden" name="stage" value={stage} />
          <select
            name="trainee_id"
            required
            onChange={(e) => {
              const opt = e.target.selectedOptions[0];
              const form = e.target.form;
              if (form) (form.elements.namedItem("trainee_name") as HTMLInputElement).value = opt?.text ?? "";
            }}
            className="h-10 rounded-[6px] border border-border bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="" disabled selected>
              Choose a candidate
            </option>
            {[...notYetInvited, ...candidates.filter((c) => invitedIds.has(c.id))].map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {invitedIds.has(c.id) ? " (reschedule)" : ""}
              </option>
            ))}
          </select>
          <input type="hidden" name="trainee_name" />
          <input
            name="event_date"
            type="date"
            required
            className="h-10 rounded-[6px] border border-border bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          />
          <input
            name="event_time"
            type="time"
            required
            className="h-10 rounded-[6px] border border-border bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Saving…" : "Invite"}
          </button>
          {state.error ? <p className="text-sm text-destructive sm:col-span-4">{state.error}</p> : null}
        </form>
      )}
    </div>
  );
}
