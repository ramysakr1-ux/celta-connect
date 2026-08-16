import { createClient } from "@/lib/supabase/server";
import type { CentreRole } from "@/lib/auth/centre-permissions";

export interface CentreRoleContext {
  /** Roles held in the centre the viewer is currently acting in. */
  roles: CentreRole[];
  /** Courses a Course administrator is scoped to. Empty for every other role. */
  scopedCourseIds: string[];
  /** The centre being acted in -- active centre if one is set and backed by a grant, else home. */
  activeCenterId: string | null;
  /** Every centre this person may switch into, for the switcher. */
  availableCenterIds: string[];
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
export async function getCentreRoleContext(profile: {
  id: string;
  center_id: string;
  active_center_id?: string | null;
}): Promise<CentreRoleContext> {
  const supabase = await createClient();

  const { data: grants } = await supabase
    .from("centre_roles")
    .select("id, center_id, role")
    .eq("profile_id", profile.id)
    .is("revoked_at", null);

  const held = grants ?? [];
  const grantedCenterIds = held.map((g) => g.center_id);

  const requested = profile.active_center_id ?? null;
  const activeCenterId =
    requested && (requested === profile.center_id || grantedCenterIds.includes(requested))
      ? requested
      : profile.center_id;

  const here = held.filter((g) => g.center_id === activeCenterId);
  const roles = here.map((g) => g.role as CentreRole);

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

  return {
    roles,
    scopedCourseIds,
    activeCenterId,
    availableCenterIds: [...new Set([profile.center_id, ...grantedCenterIds])].filter(Boolean),
  };
}
