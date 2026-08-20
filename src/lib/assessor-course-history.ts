// for-claude-code-concurrent-course-checks.md: "a centre does not choose
// its assessor, and repeat visits are common -- keep the assessor history
// per centre so it can be seen, and leave it at that." Handbook 12.3: "An
// assessor must not assess more than two concurrent courses at a centre."
// Visible-only, never enforced -- this only computes the two counts the
// doc names, it doesn't gate anything.

export interface CentreCourseWindow {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
}

export interface AssessorHistoryEntry {
  profileId: string;
  name: string;
  courses: CentreCourseWindow[];
  /** The most this assessor was ever booked on at once, by date overlap --
   *  the figure Handbook 12.3's "two concurrent" cap is about. */
  peakConcurrent: number;
  /** Length of this assessor's most recent unbroken run through the
   *  centre's own course sequence -- "repeat visits are common," so this
   *  is the "how many in a row, right now" figure, distinct from overlap. */
  currentStreak: number;
}

function overlaps(a: CentreCourseWindow, b: CentreCourseWindow): boolean {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

export function computeAssessorCentreHistory(
  centreCourses: CentreCourseWindow[],
  links: { profileId: string; name: string; courseId: string }[]
): AssessorHistoryEntry[] {
  const courseById = new Map(centreCourses.map((c) => [c.id, c]));
  const sortedCourses = [...centreCourses].sort((a, b) => a.start_date.localeCompare(b.start_date));

  const courseIdsByProfile = new Map<string, Set<string>>();
  const nameByProfile = new Map<string, string>();
  for (const link of links) {
    if (!courseById.has(link.courseId)) continue;
    nameByProfile.set(link.profileId, link.name);
    if (!courseIdsByProfile.has(link.profileId)) courseIdsByProfile.set(link.profileId, new Set());
    courseIdsByProfile.get(link.profileId)!.add(link.courseId);
  }

  const entries: AssessorHistoryEntry[] = [];
  for (const [profileId, courseIdSet] of courseIdsByProfile) {
    const theirCourses = [...courseIdSet].map((id) => courseById.get(id)!).sort((a, b) => a.start_date.localeCompare(b.start_date));

    let peakConcurrent = 0;
    for (const course of theirCourses) {
      const overlapping = theirCourses.filter((c) => overlaps(course, c)).length;
      peakConcurrent = Math.max(peakConcurrent, overlapping);
    }

    // Walk the centre's FULL course sequence (not just this assessor's own
    // courses) and keep overwriting the streak length on every run of theirs
    // -- what survives the loop is the length of their most recent run.
    let currentStreak = 0;
    let runLength = 0;
    for (const course of sortedCourses) {
      if (courseIdSet.has(course.id)) {
        runLength++;
        currentStreak = runLength;
      } else {
        runLength = 0;
      }
    }

    entries.push({ profileId, name: nameByProfile.get(profileId) ?? "Unknown", courses: theirCourses, peakConcurrent, currentStreak });
  }

  return entries.sort((a, b) => b.courses.length - a.courses.length);
}
