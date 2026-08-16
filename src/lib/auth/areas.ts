import { can, type CentreRole } from "@/lib/auth/centre-permissions";

// Pure -- no database, no server-only imports, so a client component can
// import AREAS and the verdict logic. The DB read lives in area-holders.ts:
// pulling the admin client in here put server-only code into the browser
// bundle and broke the build, the same boundary trap visibleAdminTabs hit.
//
// build-spec.md §11. A role says what someone is CAPABLE of; an area says what
// is actually THEIR JOB. The two are deliberately separate: a centre
// administrator is capable of sending offers, but if Selin holds admissions,
// sending offers is her job and everyone else sees her name where the button
// would be.

export const AREAS = [
  "admissions",
  "payments",
  "volunteers",
  "timetabling",
  "assessor_liaison",
  "close_out",
] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  admissions: "Admissions and enrolment",
  payments: "Payments",
  volunteers: "Volunteers",
  timetabling: "Timetabling",
  assessor_liaison: "Assessor liaison",
  close_out: "Close-out",
};

/** What a colleague sees in place of the action -- "Selin handles offers". */
export const AREA_VERB: Record<Area, string> = {
  admissions: "offers and applications",
  payments: "payments",
  volunteers: "volunteers",
  timetabling: "the timetable",
  assessor_liaison: "the assessor visit",
  close_out: "close-out",
};

export interface AreaHolder {
  area: Area;
  profileId: string;
  name: string;
  endsAt: string | null;
}

export type AreaVerdict =
  /** Render the action normally. */
  | { kind: "act" }
  /** Render the action, but the record must be marked as covering. */
  | { kind: "act_covering"; holder: AreaHolder }
  /** Don't render the action -- name who does instead. */
  | { kind: "attributed"; holder: AreaHolder };

/**
 * Whether this viewer may act in an area, and how it should be presented.
 *
 * Three outcomes, not two, because §11 distinguishes acting from covering:
 * "**Acting outside your own area is marked as such** on the record: 'Sent by
 * Ramy Sakr, covering admissions'. The distinction between the person
 * responsible for an area and the person who acted on one occasion is visible
 * without opening a log."
 *
 * An UNOWNED area returns "act" for anyone with the underlying capability. The
 * spec doesn't cover this case; refusing everyone would freeze a centre that
 * hasn't assigned areas yet -- the same bootstrap trap as the last owner and
 * the Hub link. Attribution still records who acted.
 */
export function areaVerdict(input: {
  area: Area;
  viewerProfileId: string;
  roles: CentreRole[];
  holders: Map<Area, AreaHolder>;
}): AreaVerdict {
  const holder = input.holders.get(input.area);

  if (!holder) return { kind: "act" };
  if (holder.profileId === input.viewerProfileId) return { kind: "act" };

  // "**The centre owner can act in any area**, because someone must when the
  // area owner is ill, and that is an ordinary Tuesday rather than an
  // emergency." Marked as covering, which is what makes it safe: without
  // attribution, covering for someone is indistinguishable from interfering
  // with them.
  if (input.roles.includes("centre_owner")) return { kind: "act_covering", holder };

  return { kind: "attributed", holder };
}

/**
 * The full check: the role must allow it AND the area must not belong to
 * someone else. A role that can't do something at all never reaches the area
 * question -- a Centre manager sees no button, not "Selin handles offers",
 * because they couldn't act even if Selin were on leave.
 */
export function canActInArea(input: {
  area: Area;
  capability: Parameters<typeof can>[1];
  viewerProfileId: string;
  roles: CentreRole[];
  holders: Map<Area, AreaHolder>;
}): AreaVerdict | { kind: "no_capability" } {
  if (!can(input.roles, input.capability)) return { kind: "no_capability" };
  return areaVerdict(input);
}
