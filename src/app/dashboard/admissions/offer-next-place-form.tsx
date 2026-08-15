"use client";

import { useActionState } from "react";
import { offerNextPlace, type FormState } from "@/app/dashboard/admissions/actions";

const initialState: FormState = { error: null };

// "The app names who is next and drafts it" -- staff only decides that a
// place has freed (from a withdrawal, deferral, or an offer that lapsed);
// the app itself picks whoever is #1 on that intake's waiting list.
export function OfferNextPlaceForm({ intakeCourseId, waitingCount }: { intakeCourseId: string; waitingCount: number }) {
  const [state, action, pending] = useActionState(offerNextPlace, initialState);

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="intake_course_id" value={intakeCourseId} />
      <span className="text-sm text-muted">
        {waitingCount} waiting
      </span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] border border-border px-3 py-1.5 text-xs text-ink hover:border-primary disabled:opacity-60"
      >
        {pending ? "Offering..." : "Offer next place"}
      </button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
