import type { ReactNode } from "react";

interface SectionLink {
  href: string;
  label: string;
  count: number;
}

// Ramy, 6 Sep 2026: "move that side panel sections, maybe have it more like
// horizontal as some kind of a pill, and put search inside of it. And then
// underneath it we'll have our cards."
//
// Was a 190px rail down the left (for-claude-code-trainer-remaining-screens.md
// "Sections" panel). Horizontal costs nothing here -- the labels are short and
// the counts shorter -- and it gives the page its full width back for the
// cards, which are the reason anyone opens it. Still purely a nav aid: every
// section it lists renders further down this page or opens its own.
//
// The search sits inside the same bar rather than floating above it, because
// both do the same job -- getting you to one thing quickly -- and two separate
// controls for that read as two unrelated features.
export function SectionsRail({ sections, search }: { sections: SectionLink[]; search?: ReactNode }) {
  return (
    <div className="sheet flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:gap-4">
      {search ? <div className="w-full lg:max-w-xs lg:shrink-0">{search}</div> : null}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {sections.map((s) => (
          <a
            key={s.href}
            href={s.href}
            className="trainer-hover-fill inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12.5px] whitespace-nowrap text-ink"
          >
            <span>{s.label}</span>
            <span className="text-[11px] text-muted tabular-nums">{s.count}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
