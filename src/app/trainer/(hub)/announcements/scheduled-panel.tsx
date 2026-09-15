"use client";

import { eventOptionLabel } from "@/lib/event-option-label";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  deleteBroadcast,
  editBroadcast,
  postBroadcastNow,
  holdBroadcast,
  resumeBroadcast,
  type FormState,
} from "@/app/portfolio/[traineeId]/stream-actions";

const initialState: FormState = { error: null };

interface TimetableEventOption {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
}

export interface ScheduledRowData {
  id: string;
  /** Per row: the MCT manages every row, an ACT only what they authored. */
  canManage?: boolean;
  title: string;
  body: string | null;
  pinned: boolean;
  keepOnDuplicate: boolean;
  anchorEventId: string;
  /** null when the row isn't anchored to a timetable event at all. */
  anchorEventTitle: string | null;
  anchorOffsetDays: number;
  fireDate: string | null;
  heldAt: string | null;
  /** Who it reaches: one candidate, one group, or the whole cohort. */
  recipient: string;
}

// Announcements Scheduled panel's Edit action -- fully spec'd by Ramy:
// inline row-replacement (not a modal), teal rule-bar while active, Cancel/
// Save, a ~2s "Saved" pill in place of the action links on success. Edit/
// saved state lives here in the parent (not per-row) so switching a row
// from editing -> just-saved -> normal doesn't need any cross-component
// signalling -- it's all one set of sibling rows reading the same two ids.
export function ScheduledPanel({
  scheduled,
  timetableEvents,
  canManage,
}: {
  scheduled: ScheduledRowData[];
  timetableEvents: TimetableEventOption[];
  // for-claude-code-mct-only-announcements.md: Post now/Hold/Resume/Edit/
  // Skip are all MCT-gated server-side now too -- hide them for anyone the
  // server would reject, rather than let a click round-trip into a silent
  // no-op.
  canManage: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!savedId) return;
    const t = setTimeout(() => setSavedId(null), 2000);
    return () => clearTimeout(t);
  }, [savedId]);

  return (
    <div className="hover-ring flex flex-col overflow-hidden rounded-[12px] border border-border bg-frame">
      <div className="flex items-center justify-between gap-3 px-[18px] pt-4 pb-2">
        <h3 className="font-serif text-[20px] font-semibold text-ink-warm">Scheduled</h3>
        <span className="text-[12.5px] text-muted">{scheduled.length === 0 ? "Nothing waiting" : `${scheduled.length} waiting`}</span>
      </div>
      {scheduled.length === 0 ? (
        <p className="px-[18px] py-4 text-sm text-muted">Anchor an announcement to a timetable event and it waits here until it fires.</p>
      ) : (
        <div className="divide-y divide-border-faint">
          {scheduled.map((row) =>
            editingId === row.id ? (
              <EditRow
                key={row.id}
                row={row}
                timetableEvents={timetableEvents}
                onCancel={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null);
                  setSavedId(row.id);
                }}
              />
            ) : (
              <ReadRow
                key={row.id}
                row={row}
                justSaved={savedId === row.id}
                canManage={row.canManage ?? canManage}
                onEdit={() => setEditingId(row.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function ReadRow({
  row,
  justSaved,
  canManage,
  onEdit,
}: {
  row: ScheduledRowData;
  justSaved: boolean;
  canManage: boolean;
  onEdit: () => void;
}) {
  const held = Boolean(row.heldAt);
  return (
    <div className={`hover-ring mx-2.5 flex flex-col gap-1.5 rounded-[10px] px-3 py-3 ${held ? "bg-surface-muted/40" : ""}`}>
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-ink">{row.title}</p>
        {held ? <span className="pill pill-neutral">Held</span> : null}
      </div>
      <p className="text-xs text-muted">
        {/* A row with no anchor event is never fired by the cron
            (announcements-cron.ts only looks at anchored rows), so it waits
            for a person -- the case the CELTA 5 Stage 3 sign-off notice is
            deliberately in, per Ramy 14 Sep 2026: "for stage three it will
            be up to the centre to decide... prepared and activated by the
            MCT." Saying "0 day(s) relative to Unknown event" at it was
            nonsense; so is offering Resume, which would clear the Held pill
            and leave it sitting unsent for ever. */}
        {row.anchorEventTitle === null
          ? held
            ? "Prepared, not scheduled — post it when the course is ready for it"
            : "Not scheduled — post it when the course is ready for it"
          : `${held ? "Won't send until resumed" : row.fireDate ? `Sends ${row.fireDate}` : "Sends when triggered"} — ${row.anchorOffsetDays} day(s) relative to "${row.anchorEventTitle}"`}
        {` · ${row.recipient}`}
      </p>
      {!canManage ? null : justSaved ? (
        <span className="pill pill-neutral w-fit">Saved</span>
      ) : (
        <div className="flex items-center gap-2.5">
          <form action={postBroadcastNow}>
            <input type="hidden" name="broadcast_id" value={row.id} />
            <button type="submit" className="text-xs font-semibold text-primary hover:underline">
              Post now
            </button>
          </form>
          <span className="text-border">|</span>
          {held && row.anchorEventTitle === null ? null : held ? (
            <form action={resumeBroadcast}>
              <input type="hidden" name="broadcast_id" value={row.id} />
              <button type="submit" className="text-xs font-semibold text-primary hover:underline">
                Resume
              </button>
            </form>
          ) : (
            <form action={holdBroadcast}>
              <input type="hidden" name="broadcast_id" value={row.id} />
              <button type="submit" className="text-xs font-semibold text-primary hover:underline">
                Hold
              </button>
            </form>
          )}
          {held && row.anchorEventTitle === null ? null : <span className="text-border">|</span>}
          <button type="button" onClick={onEdit} className="text-xs font-semibold text-primary hover:underline">
            Edit
          </button>
          <span className="text-border">|</span>
          <form action={deleteBroadcast}>
            <input type="hidden" name="broadcast_id" value={row.id} />
            <button type="submit" className="text-xs text-destructive hover:underline">
              Skip
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function EditRow({
  row,
  timetableEvents,
  onCancel,
  onSaved,
}: {
  row: ScheduledRowData;
  timetableEvents: TimetableEventOption[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState(editBroadcast, initialState);
  const [anchorEventId, setAnchorEventId] = useState(row.anchorEventId);
  const [offsetDays, setOffsetDays] = useState(String(row.anchorOffsetDays));

  // useActionState has no onSuccess hook -- a completed (pending:false),
  // error-free submit after having been pending is the signal a save just
  // landed. wasSubmitted guards against firing on first mount, where
  // pending is already false and error is already null -- a ref rather
  // than state since it's never read for rendering, only tracked.
  const wasSubmitted = useRef(false);
  useEffect(() => {
    if (pending) {
      wasSubmitted.current = true;
      return;
    }
    if (wasSubmitted.current && state.error === null) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  return (
    <form action={formAction} className="flex flex-col gap-2.5 border-l-2 border-primary px-4 py-3">
      <input type="hidden" name="broadcast_id" value={row.id} />
      <textarea
        name="title"
        defaultValue={row.title}
        rows={2}
        required
        className="rounded-[6px] border border-input bg-card p-2 text-[13px] text-ink outline-none focus:border-primary"
      />
      <textarea
        name="body"
        defaultValue={row.body ?? ""}
        rows={3}
        placeholder="Write your announcement…"
        className="rounded-[6px] border border-input bg-card p-2 text-[13px] text-ink outline-none focus:border-primary"
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted">Send timing</label>
        <div className="flex items-center gap-2">
          <select
            name="anchor_event_id"
            value={anchorEventId}
            onChange={(e) => setAnchorEventId(e.target.value)}
            required
            className="h-9 flex-1 rounded-[6px] border border-input bg-card px-2 text-sm text-ink outline-none focus:border-primary"
          >
            {timetableEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {eventOptionLabel(event)}
              </option>
            ))}
          </select>
          <input
            type="number"
            name="anchor_offset_days"
            value={offsetDays}
            onChange={(e) => setOffsetDays(e.target.value)}
            className="h-9 w-16 rounded-[6px] border border-input bg-card px-2 text-center text-sm outline-none focus:border-primary"
          />
          <span className="text-xs text-muted">days (negative = before)</span>
        </div>
      </div>
      <label className="flex items-center justify-between text-sm text-muted">
        Pin to top
        <input type="checkbox" name="pinned" defaultChecked={row.pinned} />
      </label>
      <label className="flex items-center justify-between text-sm text-muted">
        Keep when the course duplicates
        <input type="checkbox" name="keep_on_duplicate" defaultChecked={row.keepOnDuplicate} />
      </label>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink wash"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
