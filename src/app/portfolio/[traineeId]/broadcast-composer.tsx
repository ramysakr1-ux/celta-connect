"use client";

import { useActionState, useState } from "react";
import { postBroadcast, type FormState } from "@/app/portfolio/[traineeId]/stream-actions";

const initialState: FormState = { error: null };

interface TimetableEventOption {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
}

// remaining-compliance.md "Changed by decision": candidates raise concerns
// with the assessor in the meeting, not through a written channel -- the
// assessor already has no chat access. What candidates get instead is this
// calming announcement, human-reviewed before it sends (the button only
// prefills the fields, it never posts on its own).
const ASSESSOR_VISIT_TEMPLATE = {
  title: "Your assessor visit is coming up",
  body: "An external Cambridge assessor will be visiting the course soon, sitting in on some teaching practice and reviewing portfolios. This is a normal, routine part of every CELTA course -- there's nothing to prepare beyond what you're already doing. If anything is on your mind, the assessor meeting itself is the place to raise it.",
};

export function BroadcastComposer({
  traineeId,
  timetableEvents,
  assessorVisitDate,
}: {
  traineeId: string;
  timetableEvents: TimetableEventOption[];
  assessorVisitDate: string | null;
}) {
  const action = postBroadcast.bind(null, traineeId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [linkedEventId, setLinkedEventId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const showAssessorTemplate = (() => {
    if (!assessorVisitDate) return false;
    const daysUntil = Math.ceil((new Date(`${assessorVisitDate}T00:00:00`).getTime() - Date.now()) / 86400000);
    return daysUntil >= 0 && daysUntil <= 2;
  })();

  return (
    <form action={formAction} className="sheet flex flex-col gap-3 border-primary/25 bg-accent/30">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
        Broadcast to cohort
      </p>

      {showAssessorTemplate ? (
        <button
          type="button"
          onClick={() => {
            setTitle(ASSESSOR_VISIT_TEMPLATE.title);
            setBody(ASSESSOR_VISIT_TEMPLATE.body);
          }}
          className="self-start rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-gold hover:bg-gold/20"
        >
          Use assessor-visit template
        </button>
      ) : null}

      <input
        name="title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        required
        className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
      />
      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your announcement…"
        rows={3}
        className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />

      {timetableEvents.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted">
            Link a timetable event (optional) — its date/time shows automatically, no need to
            retype it
          </label>
          <select
            name="linked_timetable_event_id"
            value={linkedEventId}
            onChange={(e) => setLinkedEventId(e.target.value)}
            className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">None — ad-hoc Zoom link below</option>
            {timetableEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} — {event.event_date}
                {event.event_time ? ` ${event.event_time}` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="zoom_url"
          type="url"
          placeholder="Zoom link (optional)"
          disabled={Boolean(linkedEventId)}
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary disabled:opacity-50"
        />
        <input
          name="zoom_time"
          type="datetime-local"
          disabled={Boolean(linkedEventId)}
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary disabled:opacity-50"
        />
        <input
          name="attachment_name"
          type="text"
          placeholder="Attachment name (optional)"
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
        <input
          name="attachment_url"
          type="url"
          placeholder="Attachment link (optional)"
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="pinned" />
          Pin to top
        </label>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Posting…" : "Post announcement"}
        </button>
      </div>
    </form>
  );
}
