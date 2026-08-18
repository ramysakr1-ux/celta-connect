"use client";

import { useState } from "react";

export interface AnswerKeyTermRow {
  term: string;
  def: string;
}
export interface AnswerKeyDetailRow {
  q: string;
  a: string;
}

// PPP Input Session.dc.html's print-only answer key: hidden by default,
// "Reveal answer key" pill, then a Print button that isolates just the
// key (via a print stylesheet) so it comes out as a clean handout rather
// than the whole interactive page.
export function AnswerKey({ terms, details }: { terms: AnswerKeyTermRow[]; details: AnswerKeyDetailRow[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-print-hide
        className="self-start flex h-[34px] items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold text-ink"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="M11 12 20 3" />
          <path d="M16 8l2 2" />
          <path d="M13 11l2 2" />
        </svg>
        Reveal answer key — save or print to keep
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Answer key — handout, to keep</p>
        <div className="flex gap-2" data-print-hide>
          <button type="button" onClick={() => setOpen(false)} className="h-7 rounded-[6px] border border-border bg-card px-3 text-[11px] font-semibold text-ink">
            Hide
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-7 items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 text-[11px] font-semibold text-ink"
          >
            Print
          </button>
        </div>
      </div>
      {terms.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-[15px] font-semibold text-ink">Terms</p>
          {terms.map((row, i) => (
            <div key={i} className="grid grid-cols-[150px_1fr] gap-2.5 border-b border-border-faint py-1">
              <p className="font-serif text-xs font-semibold text-ink">{row.term}</p>
              <p className="text-[11px] leading-snug text-muted">{row.def}</p>
            </div>
          ))}
        </div>
      ) : null}
      {details.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-4">
          <p className="font-serif text-[15px] font-semibold text-ink">True or false</p>
          {details.map((row, i) => (
            <div key={i} className="flex flex-col gap-0.5 border-b border-border-faint py-1">
              <p className="text-[11.5px] text-ink">{row.q}</p>
              <p className="text-[11px] italic text-muted">{row.a}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
