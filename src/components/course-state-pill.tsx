import { computeCourseState, type CourseState } from "@/lib/course-progress";

// One pill for one fact (centre side A3, 16 Sep 2026). Three implementations
// used to answer "what state is this course in": the Centre overview's own
// inline courseState (gold / teal / grey), Course Admin's GROUP_PILL_CLASS
// (which gave Interviewing and Launching teal and Running grey -- the
// overview's colour for a CLOSED course), and the course record's single grey
// pill. Same three tints everywhere now: gold is something coming that needs
// preparing, teal is running, grey is over and deliberately inert.
//
// Lives here rather than in lib/course-progress.ts, which is a plain .ts
// module imported by server code; the state itself still comes from
// computeCourseState there.
export const COURSE_STATE_LABEL: Record<CourseState, string> = {
  upcoming: "Upcoming",
  running: "Running",
  closed: "Closed",
};

export const COURSE_STATE_TINT: Record<CourseState, string> = {
  upcoming: "bg-[color-mix(in_oklab,var(--color-gold)_14%,transparent)] text-gold",
  running: "bg-[color-mix(in_oklab,var(--color-primary)_12%,transparent)] text-primary",
  closed: "bg-surface-muted text-muted",
};

export function CourseStatePill({
  state,
  label,
  detail,
}: {
  state: CourseState;
  /** Overrides the state's own word -- Course Admin's two upcoming sub-states
   *  say "Interviewing now" and "Launching soon" and share the gold tint. */
  label?: string;
  /** "Running · W3" on the course record. */
  detail?: string;
}) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-label font-semibold ${COURSE_STATE_TINT[state]}`}>
      {label ?? COURSE_STATE_LABEL[state]}
      {detail ? ` · ${detail}` : ""}
    </span>
  );
}

export { computeCourseState };
export type { CourseState };
