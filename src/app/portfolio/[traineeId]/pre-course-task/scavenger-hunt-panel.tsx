import { SCAVENGER_HUNT_QUESTIONS } from "@/lib/scavenger-hunt";

// for-claude-code-pre-course-task-screens.md: "instrumented tour," no
// manual "mark as found" button here -- rows just reflect whatever
// markScavengerHuntFound has already recorded from real page visits.
export function ScavengerHuntPanel({ foundKeys }: { foundKeys: Set<string> }) {
  const found = SCAVENGER_HUNT_QUESTIONS.filter((q) => foundKeys.has(q.key)).length;
  const total = SCAVENGER_HUNT_QUESTIONS.length;

  return (
    <div className="sheet flex flex-col gap-3 border-l-4 border-l-[oklch(63%_0.096_72)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-[oklch(60%_0.11_70)] uppercase">Find your way around</p>
        <p className="text-xs text-muted">
          {found} of {total} found
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border-faint">
        <div
          className="h-full rounded-full bg-[oklch(63%_0.096_72)] transition-all"
          style={{ width: total > 0 ? `${(found / total) * 100}%` : "0%" }}
        />
      </div>
      <div className="flex flex-col divide-y divide-border-faint">
        {SCAVENGER_HUNT_QUESTIONS.map((q) => {
          const done = foundKeys.has(q.key);
          return (
            <div key={q.key} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
              <p className={`text-sm ${done ? "font-semibold text-ink" : "text-ink"}`}>{q.question}</p>
              {done ? (
                <span className="pill pill-success shrink-0">Found</span>
              ) : (
                <span className="shrink-0 text-xs text-muted">Not yet found</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        {found === total
          ? "All six found. Nothing else to do here before Monday."
          : "A short tour, not a test -- these resolve on their own once you actually visit each place."}
      </p>
    </div>
  );
}
