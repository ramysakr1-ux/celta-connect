"use client";

import { useActionState } from "react";
import { requestAssessorMeeting, type AssessorMeetingState } from "./assessor-meeting-actions";

const initialState: AssessorMeetingState = { error: null };

/**
 * Shown only when an assessor visit is scheduled -- there is nothing to ask for
 * otherwise, and a permanent control would read as an invitation to complain.
 *
 * The wording matters more than the button. A candidate weighing whether to
 * use this needs to know two things before they click: their tutors will not
 * see it, and asking is not itself a complaint. Both are said plainly.
 */
export function AssessorMeetingCard({
  traineeId,
  visitDate,
  alreadyRequested,
}: {
  traineeId: string;
  visitDate: string;
  alreadyRequested: boolean;
}) {
  const [state, formAction, pending] = useActionState(requestAssessorMeeting, initialState);

  return (
    <div className="sheet-accent">
      <h2 className="font-serif text-base text-ink">Speaking with the assessor</h2>
      <p className="mt-1 text-sm text-muted">
        An assessor from Cambridge visits on {visitDate}. Part of the visit is a private meeting with candidates,
        without tutors present.
      </p>

      {alreadyRequested ? (
        <>
          <p className="mt-3 text-sm text-ink">
            You&apos;ve asked to speak with them. The assessor sees only that someone has asked — not your name, and
            not what it&apos;s about.
          </p>
          <form action={formAction} className="mt-3">
            <input type="hidden" name="trainee_id" value={traineeId} />
            <input type="hidden" name="withdraw" value="1" />
            <button type="submit" disabled={pending} className="text-sm font-medium text-muted underline disabled:opacity-60">
              {pending ? "Withdrawing…" : "Withdraw the request"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">
            You can ask to be included. Your tutors are not told, and asking isn&apos;t a complaint — plenty of
            candidates simply want to talk about the course.
          </p>
          <form action={formAction} className="mt-3">
            <input type="hidden" name="trainee_id" value={traineeId} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-[6px] bg-ink-warm px-4 py-2 text-sm font-semibold text-card disabled:opacity-60"
            >
              {pending ? "Sending…" : "Ask to speak with the assessor"}
            </button>
          </form>
        </>
      )}

      {state.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
    </div>
  );
}
