"use client";

import { useState } from "react";

// Resource Hub.dc.html screen 1b, exact values -- "the hub opens as a table
// of contents," Ramy 28 Aug 2026: "it should not be lost... headings and
// subheadings, collapsible." Every category is one row in a bordered list,
// collapsed by default, click the row to expand. Pixel values (padding,
// gaps, font sizes, the chevron glyph itself) are copied from the design
// file's own script, not approximated -- same discipline as the Today card
// fix earlier tonight.
export function HubCategorySection({
  label,
  count,
  restricted,
  defaultOpen,
  children,
}: {
  label: string;
  count: string;
  restricted?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <div className="border-b border-[color-mix(in_srgb,var(--color-border)_40%,var(--color-card)_60%)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="trainee-hover-fill flex w-full items-center gap-[14px] px-5 py-[14px] text-left"
      >
        <span className="w-[10px] shrink-0 text-[11px] text-muted">{open ? "▾" : "▸"}</span>
        <span className={`font-serif flex-1 text-[12px] font-bold tracking-[0.09em] uppercase ${open ? "text-ink" : "text-muted"}`}>{label}</span>
        {restricted ? (
          <span className="shrink-0 rounded-full border border-border bg-surface-muted px-2 py-[1px] text-[10px] font-semibold text-muted">
            Trainer only
          </span>
        ) : null}
        <span className="w-[62px] shrink-0 text-right text-[12px] tabular-nums text-muted">{count}</span>
      </button>
      {open ? <div className="px-5 pb-4">{children}</div> : null}
    </div>
  );
}
