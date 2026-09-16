// What to call the page a viewer is standing on, when the viewer is not its
// owner. Shared by the assessor's read-only banner and the tutor's "Viewing as
// tutor" strip (MCT polish pass §10), so the two can never disagree on what a
// candidate's page is called.
//
// The fallback (humanise the last path segment) means a page added later
// without an explicit case here still gets a reasonable label instead of a
// blank one.
export const PATH_LABELS: { test: (p: string) => boolean; label: string }[] = [
  { test: (p) => p === "/trainer", label: "Today" },
  { test: (p) => p.startsWith("/trainer/grades-report"), label: "Grade form" },
  { test: (p) => p.startsWith("/trainer/roster"), label: "Roster" },
  { test: (p) => p.startsWith("/trainer/volunteers"), label: "Attendance register" },
  { test: (p) => p.startsWith("/trainer/timetable"), label: "Timetable" },
  { test: (p) => p.startsWith("/trainer/resource-hub"), label: "Resource hub" },
  // The two cohort documents that are pages of their own rather than a
  // read-only view of a trainer screen -- they take subject="the course"
  // at their call sites, so the sentence reads "the course's assignment
  // titles" rather than "the trainer's".
  { test: (p) => p.startsWith("/assessor/assignment-titles"), label: "Assignment titles" },
  { test: (p) => p.startsWith("/assessor/lesson-plans"), label: "Lesson plans for the day" },
  // Named rather than left to the fallback, which humanised the segment into
  // "Application Files" with a capital F (spec C4).
  { test: (p) => p.startsWith("/assessor/application-files"), label: "Application files" },
  { test: (p) => p.startsWith("/assessor/double-marking"), label: "Double-marking record" },
  { test: (p) => p.startsWith("/assessor/marking-guidance"), label: "Marking guidance" },
  { test: (p) => p.startsWith("/trainer/tp"), label: "Teaching Practice" },
  { test: (p) => p.startsWith("/trainer/rotation"), label: "Rotation" },
  { test: (p) => p.startsWith("/trainer/coursebooks"), label: "Coursebooks" },
  { test: (p) => p.startsWith("/trainer/trainer-in-training"), label: "Trainer-in-Training" },
  // Portfolio routes: matched before the generic fallback so a bare
  // /portfolio/[id] (last segment is the trainee's uuid) never ends up
  // humanized into gibberish.
  { test: (p) => /^\/portfolio\/[^/]+$/.test(p), label: "Portfolio overview" },
  { test: (p) => /^\/portfolio\/[^/]+\/assignments(\/|$)/.test(p), label: "Assignments" },
  { test: (p) => /^\/portfolio\/[^/]+\/celta5$/.test(p), label: "CELTA 5 record" },
  { test: (p) => /^\/portfolio\/[^/]+\/tp(\/|$)/.test(p), label: "Teaching practice" },
  { test: (p) => /^\/portfolio\/[^/]+\/resources$/.test(p), label: "Resources" },
  { test: (p) => /^\/portfolio\/[^/]+\/pre-course-task$/.test(p), label: "Pre-course task" },
  { test: (p) => /^\/portfolio\/[^/]+\/timetable$/.test(p), label: "Timetable" },
];

export function labelForPath(pathname: string): string {
  const known = PATH_LABELS.find((p) => p.test(pathname));
  if (known) return known.label;
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  // A bare uuid segment (any unmatched /portfolio/[id]/... shape) reads as
  // gibberish humanized -- fall back to something honest instead.
  if (!last || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last)) return "Content";
  return last
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
