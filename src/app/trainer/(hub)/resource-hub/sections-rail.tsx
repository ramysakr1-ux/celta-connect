interface SectionLink {
  href: string;
  label: string;
  count: number;
}

// for-claude-code-trainer-remaining-screens.md's "Sections" panel (190px
// rail, each section with a count). Purely a nav aid -- every section it
// lists already renders somewhere on this same page or links out to its
// own dedicated page, nothing duplicated here.
export function SectionsRail({ sections }: { sections: SectionLink[] }) {
  return (
    <div className="sheet flex h-fit flex-col gap-0.5 p-3">
      <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-[0.1em] text-muted uppercase">Sections</p>
      {sections.map((s) => (
        <a
          key={s.href}
          href={s.href}
          className="trainer-hover-fill flex items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 text-sm text-ink hover:bg-accent/40"
        >
          <span>{s.label}</span>
          <span className="text-xs tabular-nums text-muted">{s.count}</span>
        </a>
      ))}
    </div>
  );
}
