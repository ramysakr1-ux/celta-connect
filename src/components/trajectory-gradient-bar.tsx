import type { GradeDimension, Trajectory } from "@/lib/celta-criteria";
import { GRADE_DIMENSION_ORDER } from "@/lib/celta-criteria";

const STANDING_LABEL: Record<Trajectory, string> = {
  "Pass A": "Pass A",
  "Pass B": "Pass B",
  Pass: "Pass",
  Fail: "At risk",
  not_enough_data: "Not yet assessed",
};

// Position of the marker along the track, 0-100. A Fail sits on its own
// separate amber->red track rather than further along the same one -- it
// isn't "less far" than Pass, it's a different kind of signal entirely.
const MARKER_POSITION: Record<Trajectory, number> = {
  not_enough_data: 4,
  Fail: 18,
  Pass: 40,
  "Pass B": 70,
  "Pass A": 95,
};

const MARKER_COLOR: Record<Trajectory, string> = {
  not_enough_data: "var(--color-muted)",
  Fail: "var(--color-destructive)",
  Pass: "var(--color-status-on-track-text)",
  "Pass B": "oklch(65% 0.008 90)", // silver
  "Pass A": "var(--color-gold)",
};

function trackBackground(value: Trajectory): string {
  if (value === "Fail") {
    return "linear-gradient(to right, var(--color-status-warning-text), var(--color-destructive))";
  }
  if (value === "not_enough_data") {
    return "var(--color-surface-muted)";
  }
  // green (Pass) -> silver (Pass B) -> gold (Pass A), per the grading spec.
  return "linear-gradient(to right, var(--color-status-on-track-text), oklch(65% 0.008 90), var(--color-gold))";
}

function Marker({ value }: { value: Trajectory }) {
  return (
    <span
      className="absolute top-1/2 size-3 rounded-full border-2 border-card shadow-sm"
      style={{
        left: `${MARKER_POSITION[value]}%`,
        transform: "translate(-50%, -50%)",
        backgroundColor: MARKER_COLOR[value],
      }}
    />
  );
}

// §grading spec -- 5-strand gradient bar: Planning / Teaching / Awareness of
// learners / Reflection / Overall, each sliding green -> silver (Pass B) ->
// gold (Pass A), or amber -> red on a slip. Standing is always spelled out
// in words next to the bar, never colour alone -- a colour-blind trainer
// reading this at a glance matters here, given it's feeding a
// Cambridge-facing pass/fail judgement. See computeTrajectoryByDimension()
// in celta-criteria.ts for how each strand's value is derived, and its
// comment for the interim-vs-full-spec scoping note.
export function TrajectoryGradientBar({ dimension, value }: { dimension: string; value: Trajectory }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-xs text-muted">{dimension}</span>
      <span className="relative h-2 flex-1 rounded-full" style={{ background: trackBackground(value) }}>
        <Marker value={value} />
      </span>
      <span className="w-24 shrink-0 text-right text-xs font-semibold text-ink">{STANDING_LABEL[value]}</span>
    </div>
  );
}

export function TrajectoryGradientBars({ byDimension }: { byDimension: Record<GradeDimension, Trajectory> }) {
  return (
    <div className="flex flex-col gap-2.5">
      {GRADE_DIMENSION_ORDER.map((dimension) => (
        <TrajectoryGradientBar key={dimension} dimension={dimension} value={byDimension[dimension]} />
      ))}
    </div>
  );
}

// Compact single-strand variant for tight spaces (roster table cell,
// candidate card) -- shows Overall only, bar above the spelled-out label.
export function TrajectoryBarCompact({ value }: { value: Trajectory }) {
  return (
    <div className="flex w-24 flex-col items-end gap-1">
      <span className="relative h-1.5 w-full rounded-full" style={{ background: trackBackground(value) }}>
        <Marker value={value} />
      </span>
      <span className="text-xs font-semibold text-ink">{STANDING_LABEL[value]}</span>
    </div>
  );
}
