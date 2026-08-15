import { halfOwningDate, type TpTimetableEvent } from "@/lib/rotation";

export interface SubgroupMemberRow {
  traineeId: string;
  subgroupId: string;
  baseSlot: number;
}

export interface HalfInfo {
  subgroupId: string;
  halfOrder: 1 | 2;
  members: SubgroupMemberRow[];
}

// for-claude-code-timetable-view.md's "TP slots use a letter code (A-F)" --
// not a stored value anywhere (course_subgroup_members only has a numeric
// base_slot, which is rotation order, not a fixed per-person identity).
// Derived fresh each render: half 1's members get A/B/C in base_slot order,
// half 2 gets D/E/F -- matches the spec's own worked example of group codes
// "ABC"/"DEF". Only meaningful up to 3 members/half (halves of three, per
// build-spec.md); a 4th+ member has no letter and is omitted rather than
// spilling past F.
export function lettersForHalf(half: HalfInfo): Map<string, string> {
  const offset = half.halfOrder === 1 ? 0 : 3;
  const sorted = [...half.members].sort((a, b) => a.baseSlot - b.baseSlot);
  const out = new Map<string, string>();
  sorted.slice(0, 3).forEach((m, i) => {
    out.set(m.traineeId, String.fromCharCode(65 + offset + i));
  });
  return out;
}

/** The combined group code for a half, e.g. "ABC" -- letters in base_slot order. */
export function groupCodeForHalf(half: HalfInfo): string {
  const letters = lettersForHalf(half);
  return [...half.members]
    .sort((a, b) => a.baseSlot - b.baseSlot)
    .map((m) => letters.get(m.traineeId) ?? "")
    .join("");
}

export interface ViewerInvolvement {
  /** Viewer's own subgroup (half), if they belong to a paired TP group. */
  subgroupId: string | null;
  tpGroupId: string | null;
}

/**
 * The spec's "Mine" involvement rule: whole-cohort sessions are mine for
 * everyone; a session scoped to one TP group/half via its tag is mine only
 * for that group's members; a TP-type event is mine if the date belongs to
 * the viewer's own half (whichever specific slot is teaching that day).
 */
export function isMine({
  eventTag,
  eventType,
  eventDate,
  viewer,
  tpEvents,
  viewerHalfOrder,
  groupCodeByTag,
}: {
  eventTag: string | null;
  eventType: string;
  eventDate: string;
  viewer: ViewerInvolvement;
  tpEvents: TpTimetableEvent[];
  viewerHalfOrder: 1 | 2 | null;
  /** Maps a free-text tag (e.g. "ABC") to the subgroup id it refers to, if any. */
  groupCodeByTag: Map<string, string>;
}): boolean {
  if (eventType === "tp") {
    if (!viewer.subgroupId || viewerHalfOrder === null) return false;
    return halfOwningDate(tpEvents, eventDate) === viewerHalfOrder;
  }
  if (eventTag && groupCodeByTag.has(eventTag)) {
    return groupCodeByTag.get(eventTag) === viewer.subgroupId;
  }
  // No group-scoping tag -- a whole-cohort session, mine for everyone.
  return true;
}
