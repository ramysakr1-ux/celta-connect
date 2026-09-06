"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface SectionLink {
  /** In-page anchor, e.g. "#coursebooks". */
  href: string;
  label: string;
  count: number;
}

// Ramy, 6 Sep 2026, in three passes.
//
// First: "move that side panel sections, maybe have it more horizontal as some
// kind of a pill, and put search inside of it." Then, on seeing it: "I'm not
// loving it... the resource hub doesn't live up to the competition." Then, on
// the bar itself: a sticky slim strip, and "something a bit more innovative"
// than chips.
//
// Two things were wrong underneath the styling, and fixing them is most of the
// answer:
//
//   1. Half the pills went to OTHER PAGES (the TP points library, Multimedia,
//      Video Library, assignment briefs, marking guidance) and half jumped
//      down this one -- identical chips doing two unrelated jobs. The five
//      off-page ones are already the five cards below, so they are gone from
//      here. The strip is now a table of contents for THIS page and nothing
//      else.
//   2. Every count read "0" on a fresh course, so it looked broken rather than
//      empty. A count appears only when there is something to count.
//
// What makes it worth being sticky: it follows you. The section you are
// actually reading is marked as you scroll, so the strip is a position
// indicator rather than a row of buttons -- which is the difference between a
// toolbar that earns its place on a long page and one that is just chrome.
export function SectionsRail({ sections, search }: { sections: SectionLink[]; search?: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const ids = sections.map((s) => s.href.replace(/^#/, ""));
    // A plain scroll read rather than IntersectionObserver: "which heading did
    // I last pass" is a position question, and observers answer a different
    // one (what is on screen) that goes wrong the moment two short sections
    // are visible at once.
    const onScroll = () => {
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        // 140px: below the sticky strip itself, so a section counts as "here"
        // once its heading has cleared the bar rather than when it touches it.
        if (el.getBoundingClientRect().top <= 140) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  return (
    <div className="sticky top-0 z-20 -mx-6 flex flex-col gap-2 border-b border-border px-6 py-3 lg:flex-row lg:items-center lg:gap-5" style={{ background: "var(--color-frame)" }}>
      {search ? <div className="w-full lg:max-w-[280px] lg:shrink-0">{search}</div> : null}
      <div className="hidden h-6 w-px shrink-0 bg-border lg:block" aria-hidden />
      <nav className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
        {sections.map((s) => {
          const id = s.href.replace(/^#/, "");
          const on = active === id;
          return (
            <a
              key={s.href}
              href={s.href}
              aria-current={on ? "true" : undefined}
              className="inline-flex items-baseline gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors"
              style={
                on
                  ? { color: "var(--hub-accent-deep)", background: "color-mix(in oklab, var(--hub-accent) 12%, transparent)", fontWeight: 600 }
                  : { color: "var(--color-muted)" }
              }
            >
              {s.label}
              {s.count > 0 ? <span className="text-[10.5px] tabular-nums opacity-70">{s.count}</span> : null}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
