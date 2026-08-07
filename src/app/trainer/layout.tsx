// Shared shell for every /trainer/* page. No header of its own any more --
// checkpoint 1's shell consolidation (specs/build-spec.md phase 1) collapsed
// what used to be 3 stacked bars on every (hub) page down to ONE, which now
// lives entirely in (hub)/layout.tsx. The bare /trainer landing page (which
// also nests under this layout) renders its own small header locally in
// trainer/page.tsx instead, since it isn't part of the (hub) shell.
export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return (
    // min-h-screen, not min-h-full: a percentage min-height here silently
    // breaks position:sticky for any descendant (confirmed live -- the
    // timetable's floating time band would not stick until this changed).
    // min-h-screen achieves the same "fill at least the viewport" look via
    // a viewport unit instead of a parent-percentage chain, which sticky's
    // containing-block calculation doesn't choke on. Kept here since this
    // layout still wraps the timetable page underneath (hub).
    <div className="flex min-h-screen flex-col bg-background">{children}</div>
  );
}
