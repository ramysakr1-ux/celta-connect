"use client";

import { useState } from "react";
import { useIsStaffReader } from "@/components/input-sessions/audience";

export interface TrainerNote {
  label: string;
  text: string;
}

// Every session ends the same way: hidden by default, a pill to reveal,
// clearly marked "trainer only" so it's obvious this isn't candidate
// content if someone screen-shares mid-reveal.
export function TrainerNotes({ notes, runningNote }: { notes: TrainerNote[]; runningNote?: string }) {
  const [open, setOpen] = useState(false);
  // Not for candidates -- these are the answers. See audience.tsx.
  const staff = useIsStaffReader();
  if (!staff) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start flex h-[34px] items-center gap-1.5 rounded-full border border-border bg-muted/10 px-4 text-label font-semibold text-muted"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="M11 12 20 3" />
          <path d="M16 8l2 2" />
          <path d="M13 11l2 2" />
        </svg>
        Show trainer notes
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[8px] border border-destructive/25 bg-destructive/5 p-4">
      <div className="flex items-center justify-between gap-2.5">
        <p className="flex items-center gap-1.5 text-label font-bold uppercase tracking-[0.08em] text-destructive">
          <span className="size-1.5 rounded-full bg-current" />
          Trainer only — trainer notes
        </p>
        <button type="button" onClick={() => setOpen(false)} className="text-micro font-semibold text-destructive">
          Hide
        </button>
      </div>
      {runningNote ? <p className="text-label leading-relaxed text-ink">{runningNote}</p> : null}
      {notes.map((n, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <p className="text-label font-semibold text-ink">{n.label}</p>
          <p className="text-label leading-relaxed text-ink">{n.text}</p>
        </div>
      ))}
    </div>
  );
}

// The "Running this session" box near the top -- separate from the
// end-of-session trainer notes since it's meant to be read before
// starting, not toggled/hidden.
//
// STAFF ONLY, same as TrainerNotes (Ramy, 21 Sep 2026: "make sure that all
// the trainer notes there are hidden -- that was meant to be the plan from
// the start"). "Not toggled/hidden" meant it should not sit behind a pill for
// the trainer reading it; it never meant candidates should read it. 28 of the
// 31 sessions carry one and every one is written TO the trainer ABOUT the
// room -- "project it, or have trainees open it on their own devices", "do
// not let the session become a feedback session about their teaching",
// "trainees will reach for them constantly; that's the point of banning
// them". Two give away the very answer the session withholds: functional
// language and the productive skills session both say "don't name it until
// the debrief", which is the whole point of a loop input.
//
// audience.tsx defaults to staff:false, so a session rendered outside the
// provider shows no box -- the safe direction to fail, as with the notes.
export function RunningThisSession({ children }: { children: React.ReactNode }) {
  const staff = useIsStaffReader();
  if (!staff) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-[8px] border border-border bg-muted/10 p-4">
      <p className="flex items-center gap-1.5 text-label font-bold uppercase tracking-[0.08em] text-muted">
        <span className="size-1.5 rounded-full bg-current" />
        Running this session
      </p>
      <p className="text-meta leading-relaxed text-ink">{children}</p>
    </div>
  );
}
