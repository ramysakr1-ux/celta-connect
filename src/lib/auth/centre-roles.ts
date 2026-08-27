import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GrantLevel, OverrideMatrix } from "@/lib/auth/centre-permissions";

export interface CentreRoleContext {
  /** Roles held in the centre the viewer is currently acting in -- built-in slugs or owner-defined custom role keys. */
  roles: string[];
  /** Courses a Course administrator is scoped to. Empty for every other role. */
  scopedCourseIds: string[];
  /** The centre being acted in -- active centre if one is set and backed by a grant, else home. */
  activeCenterId: string | null;
  /** Every centre this person may switch into, for the switcher. */
  availableCenterIds: string[];
  /** This centre's owner-set overrides on top of MATRIX -- empty object if the owner has never touched the customizer. */
  overrides: OverrideMatrix;
  /** Custom roles the owner has defined at this centre. */
  customRoles: { role_key: string; label: string }[];
  /** Custom capabilities the owner has defined at this centre. */
  customCapabilities: { capability_key: string; label: string }[];
}

/**
 * Loads the viewer's Centre Admin role context.
 *
 * Deliberately mirrors current_center_id() (migration 0103) rather than
 * trusting profiles.active_center_id directly: the active centre only counts
 * when a live grant backs it, so a stale or tampered value resolves to the
 * home centre and grants nothing. The database enforces the same rule for RLS;
 * this is the app-side answer to the same question, and the two must agree.
 */
// Ramy, 28 Aug 2026: "no project if we don't fix this." Round 2's
// Promise.all work reduced this to its minimum sequential-STAGE count, but
// each stage still pays a real ~150-250ms Supabase round trip regardless of
// batching -- traced live, that floor is the dominant remaining cost, not
// something more parallelization can touch. This data (which roles someone
// holds, the owner's permission overrides, custom roles/capabilities)
// changes only when an owner action fires -- essentially never between one
// navigation and the next -- so it's now cached across requests for 30s
// instead of hit fresh on every single click. A stale-role window of at
// most 30s is a UI-layer tradeoff only: real data access is still enforced
// by RLS underneath regardless of what this cache says, so a revoked grant
// can't be exploited by a stale read here.
//
// unstable_cache can't use cookies() (createClient()), so this inner
// function runs entirely on the admin client -- safe here because every
// query already carries its own explicit .eq() scope (profile_id or
// center_id), the same authorization the RLS policies would have applied;
// nothing here relies on RLS's identity inference to stay correct.
//
// Ramy, 28 Aug 2026 (round 3): the 30s cache above already cut how OFTEN
// this runs, but each run still paid up to 6 separate Supabase round trips,
// and every one of those multiplies under concurrent load (measured live:
// 20 simultaneous requests to one page took up to 4x longer than the same
// request alone). get_centre_role_data (migration 0232) returns every raw
// row this function needs in ONE round trip -- it does NOT replicate any
// of the authorization decisions below (activeCenterId resolution, role
// computation, which override rows apply), only the data fetching. All of
// that logic stays exactly as it already was, just fed from one payload.
const getCachedCentreRoleData = unstable_cache(
  async (profileId: string, centerId: string, activeCenterIdRequested: string | null, role: string | undefined) => {
    const admin = createAdminClient();

    const { data: raw } = await admin.rpc("get_centre_role_data", {
      p_profile_id: profileId,
      p_center_id: centerId,
      p_active_center_id_requested: activeCenterIdRequested,
      p_is_platform_owner: role === "platform_owner",
    });

    const held = (raw?.grants ?? []) as { id: string; center_id: string; role: string }[];
    const invites = (raw?.invites ?? []) as { center_id: string }[];
    const grantedCenterIds = held.map((g) => g.center_id);

  // Migration 0212's app-side half: a platform_owner's live, un-revoked
  // invites are a second grant source, alongside centre_roles -- same
  // current_center_id()/my_center_ids() widening the DB itself now does,
  // so app-side "what can they do here" and DB-side "what can they query"
  // agree. Owner-tier only (centre_owner, per Ramy's "everything a centre
  // admin can do" -- never course data, which is a separate, course_tutors-
  // scoped door), not a role of its own -- an invite doesn't create a
  // centre_roles row, it stands alongside it.
  const invitedCenterIds = (invites ?? []).map((i) => i.center_id);

  const requested = activeCenterIdRequested;
  const activeCenterId =
    requested && (requested === centerId || grantedCenterIds.includes(requested) || invitedCenterIds.includes(requested))
      ? requested
      : centerId;

  const here = held.filter((g) => g.center_id === activeCenterId);
  const roles = here.map((g) => g.role);
  if (roles.length === 0 && invitedCenterIds.includes(activeCenterId)) {
    roles.push("centre_owner");
  }

  // Only USE course scope when a Course administrator grant is actually held
  // here -- every other role is centre-wide. The raw rows for every
  // course_administrator grant this profile holds anywhere already came
  // back in `raw`; filtering to this specific grant's id is free (no query).
  const courseAdminGrant = here.find((g) => g.role === "course_administrator");
  const allScopeRows = (raw?.course_admin_scope ?? []) as { centre_role_id: string; course_id: string }[];
  const scopedCourseIds = courseAdminGrant
    ? allScopeRows.filter((s) => s.centre_role_id === courseAdminGrant.id).map((s) => s.course_id)
    : [];

  // for-claude-code-centre-owner-role-customizer.md: only USED when this
  // person actually holds a role here at all -- someone with no centre role
  // never reaches a screen that would use these anyway. `raw` already
  // carries override/custom-role/custom-capability rows for both candidate
  // centres (home and requested); filtering to the resolved activeCenterId
  // is free (no query) instead of a conditional fetch.
  const allOverrideRows = (raw?.overrides ?? []) as { center_id: string; role_key: string; capability_key: string; granted_level: GrantLevel }[];
  const allCustomRoleRows = (raw?.custom_roles ?? []) as { center_id: string; role_key: string; label: string }[];
  const allCustomCapRows = (raw?.custom_capabilities ?? []) as { center_id: string; capability_key: string; label: string }[];

  const overrides: OverrideMatrix = {};
  const customRoles: { role_key: string; label: string }[] = [];
  const customCapabilities: { capability_key: string; label: string }[] = [];
  if (roles.length > 0 && activeCenterId) {
    for (const row of allOverrideRows) {
      if (row.center_id !== activeCenterId) continue;
      overrides[row.role_key] = overrides[row.role_key] ?? {};
      overrides[row.role_key][row.capability_key] = row.granted_level;
    }
    for (const row of allCustomRoleRows) {
      if (row.center_id === activeCenterId) customRoles.push({ role_key: row.role_key, label: row.label });
    }
    for (const row of allCustomCapRows) {
      if (row.center_id === activeCenterId) customCapabilities.push({ capability_key: row.capability_key, label: row.label });
    }
  }

  // /centre's own Overview page (build-spec.md §13) aggregates across every
  // id in this list with no further access check of its own -- it trusts
  // this array as "already granted". Deliberately only the CURRENTLY
  // active invited centre, not every live invite this platform_owner
  // holds: the Command Center's /enter/[centerId] route is the only place
  // that writes the disclosure log, so a centre only joins this list once
  // that specific route has actually been used to enter it this session --
  // never just because an invite exists somewhere.
  const availableCenterIds = [...new Set([centerId, ...grantedCenterIds, ...(invitedCenterIds.includes(activeCenterId) ? [activeCenterId] : [])])].filter(
    Boolean
  );

  return {
    roles,
    scopedCourseIds,
    activeCenterId,
    availableCenterIds,
    overrides,
    customRoles,
    customCapabilities,
  };
  },
  ["centre-role-context"],
  { revalidate: 30 }
);

// cache() keyed on the profile object's reference identity -- every call
// site gets `profile` from the (also cache()-wrapped) getCurrentProfile,
// directly or via requireRole, so they share the same reference within one
// request and this memoizes correctly. Confirmed real duplicate calls: 9
// nested pages under /centre independently re-running this (2-5 DB round
// trips each) on top of the identical call centre/layout.tsx already made
// for the same request. Layered on top of getCachedCentreRoleData's
// across-request cache -- this is the within-request layer, that one is
// the across-navigation layer.
export const getCentreRoleContext = cache(async function getCentreRoleContext(profile: {
  id: string;
  center_id: string;
  active_center_id?: string | null;
  role?: string;
}): Promise<CentreRoleContext> {
  return getCachedCentreRoleData(profile.id, profile.center_id, profile.active_center_id ?? null, profile.role);
});
