import "server-only";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface BranchScope {
  /** Every centre whose rows this page may read. Always at least one. */
  scope: string[];
  /** True when more than one centre is being read at once. */
  aggregated: boolean;
  /** The ?branch value, if it named a centre this person actually holds. */
  branch: string | null;
  /** Names for every centre in `scope`, for labelling rows that span branches. */
  nameById: Map<string, string>;
  /**
   * The single centre for anything that is configuration rather than
   * figures. There is no such thing as editing "all branches'" settings at
   * once, so those stay here and say which branch they mean.
   */
  primaryCenterId: string;
}

/**
 * Which branches a page should read.
 *
 * Centre Management and the volunteer pool have honoured the ?branch filter
 * since build-spec.md §13; Admissions and Course Admin never did. They
 * scoped hard to profiles.center_id, so somebody holding roles at two
 * branches saw two rooms showing everything and two showing one branch,
 * with nothing on screen saying so. Ramy, 1 Sep 2026, called that the real
 * asymmetry.
 *
 * The rule, taken from the owner's screen rather than invented here:
 * figures follow the filter and total across every branch when it says All
 * branches; per-centre configuration stays on one branch and names it.
 *
 * A filter can only ever narrow what someone already holds -- a branch id
 * they hold nothing at resolves to nothing, exactly as in /centre.
 */
type HeldBy = { id: string; center_id: string; active_center_id?: string | null; role?: string };

/**
 * Every centre this person holds: home, granted, and an accepted invite.
 * The same set resolveBranchScope reads from, exposed on its own for the
 * places that check ONE row rather than narrow a query.
 */
export async function heldCenterIds(profile: HeldBy): Promise<string[]> {
  const ctx = await getCentreRoleContext(profile);
  const mine = ctx.availableCenterIds.filter(Boolean);
  return mine.length > 0 ? mine : [profile.center_id].filter(Boolean);
}

/**
 * Does this person hold the centre a row belongs to?
 *
 * Audit, 6 Sep 2026: Course Admin's landing listed every held branch's
 * courses, and its course page -- and fifteen server actions behind it --
 * then compared the course's centre with profiles.center_id, the HOME
 * branch only. So an admin holding two branches was offered the other
 * branch's course and got a 404 on opening it; had it opened, every action
 * would have said "Course not found". The build lock never saw it: it
 * inspects query narrowing, and these were plain `!==` in JavaScript.
 * scripts/check-branch-scope.mjs now flags that shape too.
 *
 * Membership, not equality: the question is never "is this my home
 * centre", it is "is this a centre I hold".
 */
export async function holdsCentre(profile: HeldBy, centerId: string | null | undefined): Promise<boolean> {
  if (!centerId) return false;
  return (await heldCenterIds(profile)).includes(centerId);
}

export async function resolveBranchScope(profile: Profile, branchParam?: string): Promise<BranchScope> {
  const ctx = await getCentreRoleContext(profile);
  const held = await heldCenterIds(profile);
  const branch = branchParam && held.includes(branchParam) ? branchParam : null;
  const scope = branch ? [branch] : held;

  // Only worth a query when a name will actually be shown.
  const nameById = new Map<string, string>();
  if (scope.length > 1) {
    const { data } = await createAdminClient().from("centers").select("id, name").in("id", scope);
    for (const c of data ?? []) nameById.set(c.id, c.name);
  }

  return {
    scope,
    aggregated: scope.length > 1,
    branch,
    nameById,
    primaryCenterId: branch ?? ctx.activeCenterId ?? profile.center_id,
  };
}
