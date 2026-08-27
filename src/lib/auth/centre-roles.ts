import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OverrideMatrix } from "@/lib/auth/centre-permissions";

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
// cache() keyed on the profile object's reference identity -- every call
// site gets `profile` from the (also cache()-wrapped) getCurrentProfile,
// directly or via requireRole, so they share the same reference within one
// request and this memoizes correctly. Confirmed real duplicate calls: 9
// nested pages under /centre independently re-running this (2-5 DB round
// trips each) on top of the identical call centre/layout.tsx already made
// for the same request.
export const getCentreRoleContext = cache(async function getCentreRoleContext(profile: {
  id: string;
  center_id: string;
  active_center_id?: string | null;
  role?: string;
}): Promise<CentreRoleContext> {
  const supabase = await createClient();

  // Ramy, 27 Aug 2026: measured ~2.6-2.9s per /centre navigation, traced to
  // a chain of small sequential round trips. This query and the
  // platform_owner-only invites query below don't depend on each other --
  // both only need profile.id/profile.role, not each other's result -- so
  // they run concurrently now instead of one after another.
  const invitesPromise =
    profile.role === "platform_owner"
      ? // platform_owner_invites' own RLS (migration 0208) only lets a
        // centre's own centre_roles holders read it -- "the platform owner
        // reads every row... via the admin client," same as every other page
        // that queries this table for platform_owner's own purposes.
        createAdminClient().from("platform_owner_invites").select("center_id").is("revoked_at", null)
      : Promise.resolve({ data: [] as { center_id: string }[] });

  const [{ data: grants }, { data: invites }] = await Promise.all([
    supabase.from("centre_roles").select("id, center_id, role").eq("profile_id", profile.id).is("revoked_at", null),
    invitesPromise,
  ]);

  const held = grants ?? [];
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

  const requested = profile.active_center_id ?? null;
  const activeCenterId =
    requested && (requested === profile.center_id || grantedCenterIds.includes(requested) || invitedCenterIds.includes(requested))
      ? requested
      : profile.center_id;

  const here = held.filter((g) => g.center_id === activeCenterId);
  const roles = here.map((g) => g.role);
  if (roles.length === 0 && invitedCenterIds.includes(activeCenterId)) {
    roles.push("centre_owner");
  }

  // Only load course scope when a Course administrator grant is actually held
  // here -- every other role is centre-wide and the query would be noise.
  let scopedCourseIds: string[] = [];
  const courseAdminGrant = here.find((g) => g.role === "course_administrator");
  if (courseAdminGrant) {
    const { data: scope } = await supabase
      .from("course_administrator_scope")
      .select("course_id")
      .eq("centre_role_id", courseAdminGrant.id);
    scopedCourseIds = (scope ?? []).map((s) => s.course_id);
  }

  // for-claude-code-centre-owner-role-customizer.md: only queried when this
  // person actually holds a role here at all -- someone with no centre role
  // never reaches a screen that would use these anyway, and it saves three
  // queries on every other request in the app that touches getCurrentProfile
  // indirectly through a page that happens to call this.
  const overrides: OverrideMatrix = {};
  let customRoles: { role_key: string; label: string }[] = [];
  let customCapabilities: { capability_key: string; label: string }[] = [];
  if (roles.length > 0 && activeCenterId) {
    const [{ data: overrideRows }, { data: customRoleRows }, { data: customCapRows }] = await Promise.all([
      supabase.from("centre_permission_overrides").select("role_key, capability_key, granted_level").eq("center_id", activeCenterId),
      supabase.from("centre_custom_roles").select("role_key, label").eq("center_id", activeCenterId),
      supabase.from("centre_custom_capabilities").select("capability_key, label").eq("center_id", activeCenterId),
    ]);
    for (const row of overrideRows ?? []) {
      overrides[row.role_key] = overrides[row.role_key] ?? {};
      overrides[row.role_key][row.capability_key] = row.granted_level;
    }
    customRoles = customRoleRows ?? [];
    customCapabilities = customCapRows ?? [];
  }

  // /centre's own Overview page (build-spec.md §13) aggregates across every
  // id in this list with no further access check of its own -- it trusts
  // this array as "already granted". Deliberately only the CURRENTLY
  // active invited centre, not every live invite this platform_owner
  // holds: the Command Center's /enter/[centerId] route is the only place
  // that writes the disclosure log, so a centre only joins this list once
  // that specific route has actually been used to enter it this session --
  // never just because an invite exists somewhere.
  const availableCenterIds = [...new Set([profile.center_id, ...grantedCenterIds, ...(invitedCenterIds.includes(activeCenterId) ? [activeCenterId] : [])])].filter(
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
});
