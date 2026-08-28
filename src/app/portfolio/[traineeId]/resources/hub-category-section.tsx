"use client";

import { useState } from "react";

// Ramy, 28 Aug 2026: "I want cards, not a list" -- corrected from the first
// pass, which was still a stacked accordion list even after the border-fix,
// just with the composer moved out of the way. Each category is now its own
// independent card (rounded corners, its own border, its own background),
// laid out in a real grid with its neighbors -- not one shared bordered box
// with thin divider lines between rows. Clicking a card expands it in place
// (grows taller within the grid) rather than navigating away.
//
// Ramy, 28 Aug 2026 (again): an open category only spanned half the library
// grid (xl:col-span-2 of 4), but the item grid inside it (ResourceItemCard/
// InputSessionCard, both grid-cols-2 sm:grid-cols-3 xl:grid-cols-4) sizes
// off the VIEWPORT breakpoint, not the container it's actually sitting in --
// so on a real desktop screen it tried to lay 4 columns out in half the
// width, crushing every card down to ~140px and wrapping titles into
// unreadable columns ("Classroom management" clipped to "Classroc"). An
// open category now takes the full library width so its own item grid has
// the room it was already written assuming it had.
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
    <div className={`sheet trainee-hover flex flex-col overflow-hidden rounded-[8px] ${open ? "sm:col-span-2 xl:col-span-4" : ""}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="w-[10px] shrink-0 text-[11px] text-muted">{open ? "▾" : "▸"}</span>
        <span className={`font-serif flex-1 text-[12px] font-bold tracking-[0.09em] uppercase ${open ? "text-ink" : "text-muted"}`}>{label}</span>
        {restricted ? (
          <span className="shrink-0 rounded-full border border-border bg-surface-muted px-2 py-[1px] text-[10px] font-semibold text-muted">
            Trainer only
          </span>
        ) : null}
        <span className="w-[54px] shrink-0 text-right text-[12px] tabular-nums text-muted">{count}</span>
      </button>
      {open ? <div className="border-t border-border-faint px-4 pt-3 pb-4">{children}</div> : null}
    </div>
  );
}
