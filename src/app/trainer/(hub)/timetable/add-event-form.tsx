"use client";

import { useActionState, useState } from "react";
import { addTimetableEvent, type FormState } from "@/app/trainer/(hub)/timetable/actions";
import { ASSIGNMENT_INFO, ASSIGNMENT_ORDER } from "@/lib/assignment-info";

const EVENT_TYPE_LABELS: Record<string, string> = {
  input_session: "Input session",
  tp: "Teaching practice",
  assignment_due: "Assignment due",
  resubmission_due: "Resubmission due",
  milestone: "Milestone",
  supervised_session: "Supervised review / assignment writing",
};

const initialState: FormState = { error: null };

export function AddEventForm({
  existingEvents,
}: {
  existingEvents: { id: string; title: string; event_date: string }[];
}) {
  const [state, formAction, pending] = useActionState(addTimetableEvent, initialState);
  const [type, setType] = useState("input_session");
  const [isAsync, setIsAsync] = useState(false);

  return (
    <form action={formAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Type</label>
        <select
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value)}
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
        <label className="text-sm text-muted">
          Tag (optional -- e.g. tutor name, &quot;whole_group&quot;, &quot;individual&quot;, &quot;lunch&quot;, or
          &quot;consultation&quot;)
        </label>
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
      {type === "supervised_session" ? (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <p className="rounded-[6px] border border-dashed border-gold bg-gold/5 p-3 text-xs text-ink">
            Never call this &quot;Self-study&quot; -- name it &quot;Supervised review -- [topic]&quot; (reviewing a
            prior input session) or &quot;[Assignment] writing&quot; (time set aside to write one). It only counts as
            contact time because the trainee submits something here and you check it -- see the task each trainee
            gets on their own Timetable.
          </p>
        </div>
      ) : null}
      {type === "input_session" ? (
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-sm text-muted">Criteria covered (optional -- e.g. &quot;4c, 5f&quot;)</label>
          <input
            name="input_session_criteria"
            type="text"
            placeholder="4c, 5f"
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
          <p className="text-xs text-muted">
            Seeds that week&apos;s peer observation task -- input session → criterion → TP point → peer task.
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="is_asynchronous" checked={isAsync} onChange={(e) => setIsAsync(e.target.checked)} />
            Delivered asynchronously (recorded or Moodle, not live)
          </label>
          {isAsync ? (
            <>
              <label className="text-sm text-muted">Linked live follow-up slot</label>
              <select
                name="linked_live_session_event_id"
                required
                defaultValue=""
                className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              >
                <option value="" disabled>
                  Choose a timetable slot
                </option>
                {existingEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} -- {e.event_date}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted">
                Handbook 2.2: recorded or Moodle input must always be combined with a live follow-up
                discussion. Required before the timetable can be locked.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
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
