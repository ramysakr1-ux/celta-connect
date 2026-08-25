// for-claude-code-concurrent-course-checks.md: "a centre does not choose
// its assessor, and repeat visits are common -- keep the assessor history
// per centre so it can be seen, and leave it at that." Handbook 12.3, verbatim
// per Assessor History.dc.html: "the same assessor must not be used for more
// than two consecutive courses, and may not assess more than two courses
// concurrently at one centre." Two separate limits -- consecutive (a run
// through the centre's own course sequence) and concurrent (date-range
// overlap) -- visible-only, never enforced: this only computes the two
// figures the handbook names, it doesn't gate anything.

export interface CentreCourseWindow {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
}

export type AssessorCourseStatus = "Active" | "Upcoming" | "Completed";

export interface AssessorHistoryCourse extends CentreCourseWindow {
  /** Directional, not named -- "look at the adjacent row," matching the
   *  design spec's own sample copy ("Overlapped below"/"Overlapped
   *  above") rather than naming the other course inline. */
  overlap: "Overlapped above" | "Overlapped below" | "—";
  status: AssessorCourseStatus;
}

export type Severity = "fine" | "at-limit" | "over";

export interface AssessorHistoryEntry {
  profileId: string;
  name: string;
  courses: AssessorHistoryCourse[];
  /** The most this assessor was ever booked on at once, by date overlap --
   *  the figure Handbook 12.3's "two concurrent" cap is about. */
  peakConcurrent: number;
  peakConcurrentSeverity: Severity;
  /** Length of this assessor's most recent unbroken run through the
   *  centre's own course sequence -- "repeat visits are common," so this
   *  is the "how many in a row, right now" figure, distinct from overlap. */
  currentStreak: number;
  currentStreakSeverity: Severity;
  /** Only true when either figure has reached or passed its Handbook 12.3
   *  limit -- purely informational, per the design spec ("never blocks"). */
  flag: boolean;
  flagText: string;
}

function overlaps(a: CentreCourseWindow, b: CentreCourseWindow): boolean {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

// "ink (fine), amber (at the 2-course limit), red (over it)" -- Assessor
// History.dc.html's own severity legend, applied identically to both the
// consecutive-streak and peak-concurrent figures since Handbook 12.3 sets
// the same cap (two) on both.
function severityFor(n: number): Severity {
  if (n >= 3) return "over";
  if (n === 2) return "at-limit";
  return "fine";
}

function statusFor(course: CentreCourseWindow, today: string): AssessorCourseStatus {
  if (today < course.start_date) return "Upcoming";
  if (today > course.end_date) return "Completed";
  return "Active";
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function computeAssessorCentreHistory(
  centreCourses: CentreCourseWindow[],
  links: { profileId: string; name: string; courseId: string }[],
  today: string = new Date().toISOString().slice(0, 10)
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
    const chronological = [...courseIdSet].map((id) => courseById.get(id)!).sort((a, b) => a.start_date.localeCompare(b.start_date));

    let peakConcurrent = 0;
    for (const course of chronological) {
      const overlapping = chronological.filter((c) => overlaps(course, c)).length;
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

    // Display order is most-recent-first (matches the design sample:
    // "Active" course listed above "Completed" ones) -- overlap is
    // computed against THIS order, since "above"/"below" is a visual
    // position, not a chronological one.
    const displayOrder = [...chronological].reverse();
    const courses: AssessorHistoryCourse[] = displayOrder.map((course, i) => {
      const above = displayOrder[i - 1];
      const below = displayOrder[i + 1];
      let overlap: AssessorHistoryCourse["overlap"] = "—";
      if (above && overlaps(course, above)) overlap = "Overlapped above";
      else if (below && overlaps(course, below)) overlap = "Overlapped below";
      return { ...course, overlap, status: statusFor(course, today) };
    });

    const peakConcurrentSeverity = severityFor(peakConcurrent);
    const currentStreakSeverity = severityFor(currentStreak);

    const reasons: string[] = [];
    if (currentStreakSeverity === "over") {
      reasons.push(
        `${numberWord(currentStreak).replace(/^./, (c) => c.toUpperCase())} consecutive courses at this centre — ${numberWord(currentStreak - 2)} over the two-course guidance in Handbook 12.3.`
      );
    } else if (currentStreakSeverity === "at-limit") {
      reasons.push("Currently at the two-course consecutive limit in Handbook 12.3.");
    }
    if (peakConcurrentSeverity === "over") {
      reasons.push(`Assessed ${numberWord(peakConcurrent)} courses concurrently — over the two-course concurrent limit in Handbook 12.3.`);
    } else if (peakConcurrentSeverity === "at-limit") {
      reasons.push("Assessed two courses concurrently — at the two-course concurrent limit in Handbook 12.3.");
    }
    const flag = reasons.length > 0;
    const flagText = flag ? `${reasons.join(" ")} Not blocked; a centre does not choose its assessor.` : "";

    entries.push({
      profileId,
      name: nameByProfile.get(profileId) ?? "Unknown",
      courses,
      peakConcurrent,
      peakConcurrentSeverity,
      currentStreak,
      currentStreakSeverity,
      flag,
      flagText,
    });
  }

  return entries.sort((a, b) => b.courses.length - a.courses.length);
}
