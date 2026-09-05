// The data shape behind the Tutorials and consultations section under the
// Timetable board (design_handoff_tutorials_consultations, 5 Sep 2026).
// Built on the server in trainer/(hub)/timetable/page.tsx, rendered by
// timetable/tutorials-section.tsx. Plain data only -- it crosses the
// server/client boundary.

export type CellKind = "booked" | "waiting" | "done" | "move" | "none";

export interface InviteAction {
  type: "invite";
  stage: "stage1" | "stage3";
  traineeId: string;
  traineeName: string;
  /** Set when an invite already exists: the form reschedules and can cancel. */
  inviteId: string | null;
  date: string | null;
  time: string | null;
}

export interface PlaceSheetAction {
  type: "place-sheet";
  /** "tpgroup:<id>" or "subgroup:<id>", the Stage 2 form's own scope value. */
  scope: string;
  label: string;
}

export interface GridCell {
  kind: CellKind;
  main: string;
  sub: string;
  href?: string;
  action?: InviteAction | PlaceSheetAction;
  /** An ACT looking at another tutor's candidate: state shown, nothing to click. */
  viewOnly?: boolean;
}

export interface GridRow {
  id: string;
  name: string;
  groupName: string;
  tutorName: string;
  /** The signed-in tutor's own candidate (ACT view). */
  own: boolean;
  cells: [GridCell, GridCell, GridCell, GridCell];
}

export interface GroupSummary {
  scope: string;
  name: string;
  own: boolean;
  stage1: { total: number; filed: number; confirmed: number; pending: number; notInvited: number };
  stage2: { blockId: string; when: string; booked: number; total: number; href: string } | null;
  stage3: { flagged: { id: string; name: string; invited: boolean }[] };
}

export interface BlockSummary {
  id: string;
  tutorId: string;
  tutorName: string;
  when: string;
  booked: number;
  total: number;
  href: string;
  mine: boolean;
}

export interface TutorialsSectionData {
  viewerRole: "mct" | "act" | "admin";
  viewerId: string;
  viewerName: string;
  currentStage: 1 | 2 | 3;
  groups: GroupSummary[];
  blocks: BlockSummary[];
  rows: GridRow[];
  /** Tutors on the course, for the MCT's "Add block" tutor select. */
  tutors: { id: string; name: string }[];
}

export function shortDate(iso: string): string {
  // Node's ICU spells September "Sept" in en-GB; the handoff (and every
  // other hub date) says "Sep".
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace("Sept", "Sep");
}

export function shortTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}

/** "week 3 of 4" → 3; before the course, 1; after, 3 -- which stage the card opens on. */
export function stageForWeek(weekLabel: string | null): 1 | 2 | 3 {
  const m = weekLabel?.match(/week (\d+) of (\d+)/);
  if (!m) return 1;
  const week = Number(m[1]);
  const total = Number(m[2]);
  if (week <= 1) return 1;
  if (week >= total) return 3;
  return 2;
}
