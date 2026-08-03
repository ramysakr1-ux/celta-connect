"use client";

import { useActionState } from "react";
import { addTimetableEvent, type FormState } from "@/app/trainer/timetable/actions";
import { ASSIGNMENT_INFO, ASSIGNMENT_ORDER } from "@/lib/assignment-info";

const EVENT_TYPE_LABELS: Record<string, string> = {
  input_session: "Input session",
  tp: "Teaching practice",
  assignment_due: "Assignment due",
  resubmission_due: "Resubmission due",
  milestone: "Milestone",
};

const initialState: FormState = { error: null };

export function AddEventForm() {
  const [state, formAction, pending] = useActionState(addTimetableEvent, initialState);

  return (
    <form action={formAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Type</label>
        <select
          name="type"
          required
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        >
          {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Title</label>
        <input
          name="title"
          type="text"
          required
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Date</label>
        <input
          name="event_date"
          type="date"
          required
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Time (optional)</label>
        <input
          name="event_time"
          type="time"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Tag (optional -- e.g. tutor name)</label>
        <input
          name="tag"
          type="text"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Zoom link (optional)</label>
        <input
          name="zoom_url"
          type="url"
          placeholder="https://zoom.us/j/…"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Linked assignment (optional)</label>
        <select
          name="linked_assignment_type"
          defaultValue=""
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">None</option>
          {ASSIGNMENT_ORDER.map((type) => (
            <option key={type} value={type}>
              {ASSIGNMENT_INFO[type].title}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Linked TP (optional)</label>
        <select
          name="linked_tp_number"
          defaultValue=""
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">None</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              TP{n}
            </option>
          ))}
        </select>
      </div>
      {state.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60 sm:col-span-2"
      >
        {pending ? "Adding…" : "Add event"}
      </button>
    </form>
  );
}
