"use client";

import { useActionState } from "react";
import {
  addAvailabilityPattern,
  removeAvailabilityPattern,
  addInterviewBlock,
  removeInterviewBlock,
  updateInterviewGenerationSettings,
  regenerateInterviewSlots,
  type RegenState,
} from "@/app/dashboard/admissions/actions";

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const inputClass = "h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink outline-none focus:border-primary";

export interface PatternRow {
  id: string;
  interviewerId: string;
  interviewerName: string;
  weekday: number;
  startTime: string;
  endTime: string;
  mode: "online" | "face_to_face";
}

export interface BlockRow {
  id: string;
  interviewerName: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

const regenInitial: RegenState = { error: null };

// Interview Availability.dc.html: "Slots are generated from a rule, not
// typed in every week." Three panels -- the weekly pattern per person, the
// generation rule everyone shares, and blocking a day out.
export function InterviewAvailabilityPanel({
  interviewers,
  patterns,
  blocks,
  settings,
}: {
  interviewers: { id: string; name: string }[];
  patterns: PatternRow[];
  blocks: BlockRow[];
  settings: { slotMinutes: number; gapMinutes: number; weeksAhead: number; cutoffHours: number };
}) {
  const [blockState, blockAction, blockPending] = useActionState(addInterviewBlock, regenInitial);
  const [regenState, regenAction, regenPending] = useActionState(regenerateInterviewSlots, regenInitial);

  return (
    <div className="flex flex-col gap-5">
      {/* Generation rule */}
      <div>
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">The rule that makes the slots</p>
        <form action={updateInterviewGenerationSettings} className="mt-2 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Interview length (min)</span>
            <input name="interview_slot_minutes" type="number" min={5} defaultValue={settings.slotMinutes} className={`${inputClass} w-24`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Gap after (min)</span>
            <input name="interview_gap_minutes" type="number" min={0} defaultValue={settings.gapMinutes} className={`${inputClass} w-24`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Weeks ahead</span>
            <input name="interview_weeks_ahead" type="number" min={1} max={8} defaultValue={settings.weeksAhead} className={`${inputClass} w-20`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Booking cut-off (hrs)</span>
            <input name="interview_cutoff_hours" type="number" min={0} defaultValue={settings.cutoffHours} className={`${inputClass} w-24`} />
          </label>
          <button type="submit" className="h-9 rounded-[6px] border border-border px-3 text-xs font-semibold text-ink hover:border-primary admin-hover-fill">
            Save
          </button>
        </form>
      </div>

      {/* Pattern editor */}
      <div className="border-t border-border pt-4">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Weekly pattern -- who interviews when</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {patterns.length === 0 ? (
            <p className="text-sm text-muted">No pattern set yet.</p>
          ) : (
            patterns.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-[6px] bg-surface-muted/50 px-3 py-2 text-sm admin-hover">
                <span className="text-ink">
                  {p.interviewerName} -- {WEEKDAY_LABELS[p.weekday]}, {p.startTime.slice(0, 5)}-{p.endTime.slice(0, 5)} (
                  {p.mode === "online" ? "online" : "face to face"})
                </span>
                <form action={removeAvailabilityPattern}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="text-xs text-muted hover:text-destructive">
                    Remove
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
        <form action={addAvailabilityPattern} className="mt-3 flex flex-wrap items-end gap-2">
          <select name="interviewer_id" defaultValue="" className={inputClass}>
            <option value="">Yourself</option>
            {interviewers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <select name="weekday" defaultValue="1" className={inputClass}>
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </select>
          <input name="start_time" type="time" required className={inputClass} />
          <span className="text-xs text-muted">to</span>
          <input name="end_time" type="time" required className={inputClass} />
          <select name="mode" defaultValue="face_to_face" className={inputClass}>
            <option value="face_to_face">Face to face</option>
            <option value="online">Online</option>
          </select>
          <button type="submit" className="h-9 rounded-[6px] bg-primary px-3 text-xs font-semibold text-primary-foreground">
            Add window
          </button>
        </form>
      </div>

      {/* Blocking */}
      <div className="border-t border-border pt-4">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Block a day out</p>
        <p className="mt-1 text-xs text-muted">
          Leave interviewer blank for a centre-wide closure -- set once for everybody, not by each interviewer separately.
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {blocks.length === 0 ? (
            <p className="text-sm text-muted">No blocks set.</p>
          ) : (
            blocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-[6px] bg-surface-muted/50 px-3 py-2 text-sm admin-hover">
                <span className="text-ink">
                  {b.interviewerName ?? "Centre-wide"} -- {b.startDate}
                  {b.endDate !== b.startDate ? ` to ${b.endDate}` : ""}
                  {b.startTime && b.endTime ? ` · ${b.startTime.slice(0, 5)}-${b.endTime.slice(0, 5)}` : " · all day"}
                  {b.reason ? ` · ${b.reason}` : ""}
                </span>
                <form action={removeInterviewBlock}>
                  <input type="hidden" name="id" value={b.id} />
                  <button type="submit" className="text-xs text-muted hover:text-destructive">
                    Remove
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
        <form action={blockAction} className="mt-3 flex flex-wrap items-end gap-2">
          <select name="interviewer_id" defaultValue="" className={inputClass}>
            <option value="">Centre-wide closure</option>
            {interviewers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <input name="start_date" type="date" required className={inputClass} />
          <span className="text-xs text-muted">to</span>
          <input name="end_date" type="date" className={inputClass} />
          <input name="start_time" type="time" className={inputClass} placeholder="All day" />
          <span className="text-xs text-muted">to</span>
          <input name="end_time" type="time" className={inputClass} />
          <input name="reason" placeholder="Reason (optional)" className={`${inputClass} min-w-[160px]`} />
          <button type="submit" disabled={blockPending} className="h-9 rounded-[6px] border border-border px-3 text-xs font-semibold text-ink hover:border-primary disabled:opacity-60 admin-hover-fill">
            {blockPending ? "Saving…" : "Block"}
          </button>
        </form>
        {blockState.error ? <p className="mt-1 text-xs text-destructive">{blockState.error}</p> : null}
      </div>

      {/* Regenerate */}
      <div className="border-t border-border pt-4">
        <form action={regenAction} className="flex flex-wrap items-center gap-3">
          <select name="interviewer_id" defaultValue="" className={inputClass}>
            <option value="">Yourself</option>
            {interviewers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={regenPending} className="h-9 rounded-[6px] bg-ink-warm px-4 text-xs font-semibold text-card hover:bg-ink-warm/90 disabled:opacity-60">
            {regenPending ? "Generating…" : "Generate slots from pattern"}
          </button>
          {regenState.created !== undefined ? (
            <span className="text-xs text-primary">{regenState.created} slot{regenState.created === 1 ? "" : "s"} created.</span>
          ) : null}
          {regenState.error ? <span className="text-xs text-destructive">{regenState.error}</span> : null}
        </form>
        <p className="mt-1.5 text-xs text-muted">
          Nobody maintains a calendar. Regenerating replaces every unbooked slot with a fresh set from the current
          pattern -- booked slots stay exactly where they are.
        </p>
      </div>
    </div>
  );
}
