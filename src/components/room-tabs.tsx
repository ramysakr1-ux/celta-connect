"use client";

import Link from "next/link";

// One tab row for every room (centre side B4, 16 Sep 2026). Centre
// Management, Admissions and Centre settings each carried their own copy of
// the same 14px/medium/border-b-2 nav, with two different hovers between them
// (border-and-text in the accent on two, a background wash to ink on the
// third). One row, one hover; the only difference left is whether a tab is a
// route (a Link) or a section of the page you are already on (a button).
//
// The row scrolls rather than wraps -- Ramy, 2 Sep 2026, on a phone: 7px of
// overflow was enough to slide the whole page sideways.
function tabClass(active: boolean): string {
  return `-mb-[3px] shrink-0 border-b-2 px-3 pb-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
    active ? "border-primary text-primary" : "border-transparent text-muted hover:border-primary/40 hover:text-primary"
  }`;
}

export function RoomTabs({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <nav className="flex items-center justify-between gap-4 border-b border-border pb-0.5">
      <div className="scroll-row flex min-w-0 gap-2">{children}</div>
      {/* An action beside the tabs never shrinks: one that has already been
          moved once for being hard to find should not become hard to read. */}
      {action ? <div className="mb-1 shrink-0">{action}</div> : null}
    </nav>
  );
}

export function RoomTabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={tabClass(active)}>
      {children}
    </Link>
  );
}

export function RoomTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={tabClass(active)}>
      {children}
    </button>
  );
}
