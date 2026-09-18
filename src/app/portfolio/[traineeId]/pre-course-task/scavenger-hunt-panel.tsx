import { SCAVENGER_HUNT_QUESTIONS } from "@/lib/scavenger-hunt";

// for-claude-code-pre-course-task-screens.md: "instrumented tour," no
// manual "mark as found" button here -- rows just reflect whatever
// markScavengerHuntFound has already recorded from real page visits.
//
// A strip, not a column, since 19 Sep 2026: it used to sit beside the
// pre-course task at a third of the width, which put six lines of tour next
// to four hours of work and doubled the scrolling to read the task. The six
// questions run as a wrapping row; the progress bar and the count keep their
// place at the top.
export function ScavengerHuntPanel({ foundKeys }: { foundKeys: Set<string> }) {
  const found = SCAVENGER_HUNT_QUESTIONS.filter((q) => foundKeys.has(q.key)).length;
  const total = SCAVENGER_HUNT_QUESTIONS.length;

  return (
    <div className="plain-card flex flex-col gap-3 border-l-4 border-l-[oklch(63%_0.096_72)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-label font-semibold tracking-[0.08em] text-[oklch(60%_0.11_70)] uppercase">Find your way around</p>
        <p className="text-label text-muted">
          {found} of {total} found
          {" \u00b7 "}
          {found === total
            ? "all six, nothing else to do here before Monday"
            : "a short tour, not a test -- these resolve on their own once you visit each place"}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border-faint">
        <div
          className="h-full rounded-full bg-[oklch(63%_0.096_72)] transition-all"
          style={{ width: total > 0 ? `${(found / total) * 100}%` : "0%" }}
        />
      </div>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {SCAVENGER_HUNT_QUESTIONS.map((q) => {
          const done = foundKeys.has(q.key);
          return (
            <li key={q.key} className="flex items-start gap-2 text-body">
              <span
                aria-hidden
                className={`mt-[7px] size-2 shrink-0 rounded-full ${done ? "bg-[oklch(63%_0.096_72)]" : "border border-border"}`}
              />
              <span className={done ? "font-semibold text-ink" : "text-ink"}>
                {q.question}
                {done ? <span className="ml-1.5 text-label font-normal text-muted">Found</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
