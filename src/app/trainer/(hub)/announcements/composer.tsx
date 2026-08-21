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

// for-claude-code-trainer-remaining-screens.md's "Write an announcement"
// panel -- same core form BroadcastComposer (Today's quick-post widget)
// already used, extended with the Scheduled panel's send-timing and
// keep-on-duplicate controls. The linked timetable event doubles as the
// anchor when "before/after that event" is chosen, rather than asking for
// the same event twice.
interface GroupOption {
  id: string;
  name: string;
  memberCount: number;
}

export function AnnouncementComposer({
  timetableEvents,
  showAssessorTemplate,
  traineeCount,
  trainerCount,
  groups,
}: {
  timetableEvents: TimetableEventOption[];
  showAssessorTemplate: boolean;
  traineeCount: number;
  trainerCount: number;
  groups: GroupOption[];
}) {
  const [state, formAction, pending] = useActionState(postBroadcast, initialState);
  const [linkedEventId, setLinkedEventId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [timing, setTiming] = useState<"now" | "anchored">("now");
  const [offsetDays, setOffsetDays] = useState("-2");
  const [groupScopeId, setGroupScopeId] = useState("");
  const selectedGroup = groups.find((g) => g.id === groupScopeId) ?? null;

  return (
    <form action={formAction} className="sheet flex flex-col gap-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Write an announcement</p>

      {showAssessorTemplate ? (
        <button
          type="button"
          onClick={() => {
            setTitle(ASSESSOR_VISIT_TEMPLATE.title);
            setBody(ASSESSOR_VISIT_TEMPLATE.body);
          }}
          className="self-start rounded-full border border-border bg-muted/10 px-3 py-1 text-xs font-medium text-muted hover:bg-muted/20"
        >
          Use assessor-visit template
        </button>
      ) : null}

      {groups.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted">Send to</label>
          <select
            value={groupScopeId}
            onChange={(e) => setGroupScopeId(e.target.value)}
            className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">Whole cohort</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} only
              </option>
            ))}
          </select>
          <input type="hidden" name="visible_to_tp_group_id" value={groupScopeId} />
        </div>
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
            Link a timetable event (optional) — its date/time shows automatically, and it's what a
            scheduled send below anchors to
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

      <div className="flex flex-col gap-1.5 rounded-[6px] border border-border-faint p-2.5">
        <p className="text-xs font-semibold text-ink">Send timing</p>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" checked={timing === "now"} onChange={() => setTiming("now")} />
          Now
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="radio"
            checked={timing === "anchored"}
            onChange={() => setTiming("anchored")}
            disabled={!linkedEventId}
          />
          <span className={!linkedEventId ? "text-muted" : ""}>
            {timing === "anchored" ? (
              <>
                <input
                  type="number"
                  value={offsetDays}
                  onChange={(e) => setOffsetDays(e.target.value)}
                  className="mx-1 h-7 w-14 rounded-[4px] border border-input bg-card px-1.5 text-center text-sm outline-none focus:border-primary"
                />
                days relative to the linked event (negative = before)
              </>
            ) : (
              "Days relative to the linked event"
            )}
          </span>
        </label>
        {timing === "anchored" ? (
          <>
            <input type="hidden" name="anchor_event_id" value={linkedEventId} />
            <input type="hidden" name="anchor_offset_days" value={offsetDays} />
          </>
        ) : null}
      </div>

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
      <p className="text-xs text-muted">
        {selectedGroup
          ? `This goes to ${selectedGroup.memberCount} candidate${selectedGroup.memberCount === 1 ? "" : "s"} in ${selectedGroup.name}`
          : `This goes to ${traineeCount} candidate${traineeCount === 1 ? "" : "s"} and ${trainerCount} tutor${trainerCount === 1 ? "" : "s"}`}{" "}
        {timing === "anchored" ? "once it fires" : "now"}.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="pinned" />
            Pin to top
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="keep_on_duplicate" />
            Keep when the course duplicates
          </label>
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : timing === "anchored" ? "Schedule" : "Post announcement"}
        </button>
      </div>
    </form>
  );
}
