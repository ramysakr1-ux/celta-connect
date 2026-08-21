"use client";

import { useState } from "react";

export interface TrainerNote {
  label: string;
  text: string;
}

// Every session ends the same way: hidden by default, a pill to reveal,
// clearly marked "trainer only" so it's obvious this isn't candidate
// content if someone screen-shares mid-reveal.
export function TrainerNotes({ notes, runningNote }: { notes: TrainerNote[]; runningNote?: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start flex h-[34px] items-center gap-1.5 rounded-full border border-border bg-muted/10 px-4 text-xs font-semibold text-muted"
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
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-destructive">
          <span className="size-1.5 rounded-full bg-current" />
          Trainer only — trainer notes
        </p>
        <button type="button" onClick={() => setOpen(false)} className="text-[10.5px] font-semibold text-destructive">
          Hide
        </button>
      </div>
      {runningNote ? <p className="text-xs leading-relaxed text-ink">{runningNote}</p> : null}
      {notes.map((n, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-ink">{n.label}</p>
          <p className="text-xs leading-relaxed text-ink">{n.text}</p>
        </div>
      ))}
    </div>
  );
}

// The "Running this session" box near the top -- separate from the
// end-of-session trainer notes since it's meant to be read before
// starting, not toggled/hidden.
export function RunningThisSession({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[8px] border border-border bg-muted/10 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
        <span className="size-1.5 rounded-full bg-current" />
        Running this session
      </p>
      <p className="text-[12.5px] leading-relaxed text-ink">{children}</p>
    </div>
  );
}
