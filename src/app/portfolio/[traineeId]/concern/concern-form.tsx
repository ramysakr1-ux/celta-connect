"use client";

import { useActionState, useState } from "react";
import { submitConcern, type ConcernFormState } from "@/app/portfolio/[traineeId]/concern-actions";

const initialState: ConcernFormState = { error: null };

const ROUTES: { value: "tutor" | "mct" | "manager"; label: string; note: string }[] = [
  { value: "tutor", label: "My tutor", note: "The fastest route for anything about a lesson, feedback or a deadline." },
  { value: "mct", label: "The Main Course Tutor", note: "For something about the course as a whole, or about another tutor." },
  { value: "manager", label: "The centre manager", note: "Independent of the teaching team. For anything you would rather the tutors did not see first." },
];

export function ConcernForm({ traineeId }: { traineeId: string }) {
  const [state, formAction, pending] = useActionState(submitConcern, initialState);
  const [route, setRoute] = useState<"tutor" | "mct" | "manager">("tutor");

  if (state.sent) {
    return (
      <div className="rounded-[6px] border border-border-faint bg-surface-muted/40 p-4">
        <p className="text-sm font-semibold text-primary">Sent.</p>
        <p className="mt-1 text-sm text-muted">The centre replies to every concern.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="trainee_id" value={traineeId} />
      <input type="hidden" name="route" value={route} />

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted">Who should see this?</p>
        {ROUTES.map((r) => (
          <label
            key={r.value}
            className={`flex cursor-pointer items-start gap-2.5 rounded-[6px] border p-3 ${
              route === r.value ? (r.value === "manager" ? "border-status-warning-text bg-status-warning-bg" : "border-primary bg-primary/5") : "border-border"
            }`}
          >
            <input type="radio" name="route_radio" checked={route === r.value} onChange={() => setRoute(r.value)} className="mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-ink">{r.label}</p>
              <p className="text-xs text-muted">{r.note}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="text-xs text-muted">
          What has happened
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={4}
          placeholder="Write or dictate…"
          className="rounded-[6px] border border-border bg-card-inset px-2.5 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" name="anonymous" className="mt-0.5" />
        Send this anonymously — the centre manager sees the concern but not my name
      </label>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Sending…" : `Send to ${ROUTES.find((r) => r.value === route)?.label}`}
      </button>
    </form>
  );
}
