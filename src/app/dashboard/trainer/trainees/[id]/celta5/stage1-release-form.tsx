"use client";

import { useActionState } from "react";
import { setStage1Release } from "@/app/dashboard/trainer/celta5-actions";
import type { FormState } from "@/app/dashboard/trainer/celta5-actions";

const initial: FormState = { error: null };

// Ramy, 29 Aug 2026: Stage One is tutor-gated -- "the trainee sees nothing
// until the tutor hits Release to trainee". Deliberately its own control
// rather than another checkbox inside the Stage One form: saving the report
// and publishing it to the candidate are two different decisions, and
// merging them is the bug being fixed here.
export function Stage1ReleaseForm({
  traineeId,
  completedAt,
  releasedAt,
  candidateSignedAt,
}: {
  traineeId: string;
  completedAt: string | null;
  releasedAt: string | null;
  candidateSignedAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(setStage1Release, initial);
  const released = Boolean(releasedAt);

  return (
    <div className="sheet flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg text-ink">Release Stage One to the candidate</h3>
          <p className="mt-0.5 text-sm text-muted">
            {!completedAt
              ? "Finish and sign Stage One above first — there is nothing to release yet."
              : released
                ? `Released ${new Date(releasedAt!).toLocaleString()}. They can read and sign it.`
                : "Written but not yet visible to the candidate."}
          </p>
        </div>
        <span className={`pill shrink-0 ${released ? "pill-success" : "pill-warning"}`}>{released ? "Released" : "Not released"}</span>
      </div>

      {/* The warning that matters: re-releasing clears a signature they have
          already given, because it attested to the text as it was. Said
          before they press it, not after. */}
      {released && candidateSignedAt ? (
        <p className="rounded-[6px] border border-border bg-surface-muted px-3 py-2 text-xs text-ink">
          They signed this on {new Date(candidateSignedAt).toLocaleDateString()}. If you un-release and release a revised
          version, that signature is cleared and they will be asked to sign again.
        </p>
      ) : null}

      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

      <form action={formAction}>
        <input type="hidden" name="trainee_id" value={traineeId} />
        <input type="hidden" name="release" value={released ? "off" : "on"} />
        <button
          type="submit"
          disabled={pending || (!completedAt && !released)}
          className={`rounded-[6px] px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
            released ? "border border-border text-ink admin-hover-fill" : "bg-primary text-primary-foreground"
          }`}
        >
          {pending ? "Saving…" : released ? "Un-release" : "Release to trainee"}
        </button>
      </form>
    </div>
  );
}
