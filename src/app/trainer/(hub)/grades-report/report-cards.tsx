"use client";

import { useState } from "react";

// The Grades Report's building blocks.
//
// Ramy, 30 Aug 2026: "planning strengths will go inside its own box, and the
// criteria inside that, like a card, and then action points the same thing...
// so they need to be distinct." And on the shape overall: "on the left,
// provisionals with lesson planning action points, strengths, teaching action
// points, strengths... and then on the right, the justifications, because
// it's the same thing on Appian. So it needs to look the same."
//
// The accent carries the meaning -- teal for what the candidate does well,
// amber for what they still have to work on -- so the two never read as one
// long list. Planning versus teaching is carried by the title, because a
// third and fourth colour would need a legend and mean nothing on its own.

type Accent = "good" | "work" | "grade" | "text" | "plain";

const ACCENT_CLASS: Record<Accent, string> = {
  good: "border-t-primary",
  work: "border-t-status-warning-text",
  grade: "border-t-ink-warm",
  text: "border-t-gold",
  plain: "border-t-border",
};

const LABEL_CLASS: Record<Accent, string> = {
  good: "text-primary",
  work: "text-status-warning-text",
  grade: "text-ink-warm",
  text: "text-muted",
  plain: "text-muted",
};

/**
 * Copies one Appian field. Ramy: "is it possible to copy paste all this into
 * Appian?" -- per field rather than one blob, because the real report
 * (C14_GREEN - Final Grades.docx) has nine separate fields and pasting one
 * lump into any of them would need picking apart by hand.
 *
 * Plain text with newlines: enterprise form fields usually strip anything
 * else, and a list of criteria pastes as lines in every one I have seen.
 */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  if (!value.trim()) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="trainer-hover-fill shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold text-muted"
      aria-label={`Copy ${label} for Appian`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function ReportCard({
  title,
  accent = "plain",
  copyValue,
  children,
}: {
  title: string;
  accent?: Accent;
  copyValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`card border-t-[3px] p-4 ${ACCENT_CLASS[accent]}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className={`text-[10px] font-bold tracking-[0.09em] uppercase ${LABEL_CLASS[accent]}`}>{title}</p>
        {copyValue ? <CopyField value={copyValue} label={title} /> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * One of the four criteria lists.
 *
 * Lines, not a comma-joined paragraph: since the report started quoting
 * Cambridge verbatim ("identifying and stating appropriate aims/outcomes for
 * individual lessons (4a)") a joined run of them is unreadable, and the real
 * report writes one per line too.
 */
export function CriteriaListCard({
  title,
  accent,
  items,
}: {
  title: string;
  accent: "good" | "work";
  items: string[];
}) {
  return (
    <ReportCard title={title} accent={accent} copyValue={items.join("\n")}>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-[12.5px] leading-[1.5] text-ink">
              <span className={accent === "good" ? "text-primary" : "text-status-warning-text"}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-muted">None</p>
      )}
    </ReportCard>
  );
}
