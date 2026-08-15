import { Laptop } from "lucide-react";

// specs/build-spec.md §7: "Laptop only -- marking against criteria, the
// rotation board, the grade meeting, editing the timetable, centre setup.
// Say so on the phone rather than shipping a cramped version." Pure CSS
// breakpoint swap (no client JS/media-query hook needed) -- `children` only
// ever renders at `md:` and above; below that, a plain message takes its
// place. Server component, works from any page.
export function LaptopOnlyGate({
  task,
  skip = false,
  children,
}: {
  task: string;
  // e.g. Grades Report is also assessor-facing, and specs/build-spec.md §7
  // grants assessor sessions "reading" on mobile -- callers with a
  // dual-audience page pass skip=true for the audience that should stay
  // ungated instead of hardcoding a second copy of the page.
  skip?: boolean;
  children: React.ReactNode;
}) {
  if (skip) return <>{children}</>;
  return (
    <>
      <div className="hidden md:block">{children}</div>
      <div className="flex flex-col items-center gap-3 py-16 text-center md:hidden">
        <Laptop className="size-8 text-muted" aria-hidden="true" />
        <p className="max-w-[280px] text-sm text-muted">
          {task} needs more room than a phone screen -- open this on a laptop or tablet.
        </p>
      </div>
    </>
  );
}
