import { createAdminClient } from "@/lib/supabase/admin";
import { can, type CentreRole } from "@/lib/auth/centre-permissions";

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

/**
 * Who holds each area in this centre. Read through the admin client because
 * this is displayed to everyone -- "areas never hide information" -- and the
 * join to profiles for a name would otherwise depend on a second policy
 * agreeing about a person the viewer may not otherwise be able to read.
 */
export async function getAreaHolders(centerId: string): Promise<Map<Area, AreaHolder>> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows } = await admin
    .from("centre_areas")
    .select("area, profile_id, ends_at")
    .eq("center_id", centerId)
    .is("revoked_at", null);

  // A temporary handover lapses on its own rather than needing anyone to
  // remember -- that's the whole reason ends_at exists.
  const live = (rows ?? []).filter((r) => !r.ends_at || r.ends_at >= today);
  if (live.length === 0) return new Map();

  const { data: people } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", live.map((r) => r.profile_id));
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  return new Map(
    live.map((r) => [
      r.area as Area,
      { area: r.area as Area, profileId: r.profile_id, name: nameOf.get(r.profile_id) ?? "Someone", endsAt: r.ends_at },
    ])
  );
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
