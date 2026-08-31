import "server-only";
import { requireRole } from "@/lib/auth/require-role";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";

/**
 * Requires a CAPABILITY, not a job title.
 *
 * Found 31 Aug 2026 by sweeping every mutating server action under /centre
 * and /dashboard/admin. Nine action files -- assignment briefs, coursebooks,
 * tutor assignment, deferrals, invitations, restarts, the roster, subgroups
 * and centre settings -- gated on `requireRole("admin")` alone. That is the
 * flat legacy role, which every member of the centre-admin family holds,
 * INCLUDING centre_manager: the read-only "Centre observer" whose entire
 * definition is "cannot edit anything at all".
 *
 * The screens were right -- they ask can() and omit the controls. But a
 * server action is an HTTP endpoint, and hiding a button does not stop
 * anyone calling it. So the read-only role could change the centre's name
 * and number, defer a candidate, reassign tutors or edit the roster by
 * invoking the action directly. Same shape as the three separate cases
 * found earlier the same day (the import RLS policies, the new-course
 * wizard, the "New course" button): a capability the write path never
 * consulted.
 *
 * Every admin and platform_owner in this database already holds a centre
 * role, checked before this went in, so requiring one locks nobody out.
 *
 * Throws rather than redirects: these are called from server actions, where
 * a thrown error surfaces as a failed action, and a redirect out of a POST
 * is a worse experience than an honest refusal.
 */
export async function requireCapability(capability: string) {
  const profile = await requireRole("admin");

  // platform_owner keeps its standing pass, as it does in requireRole --
  // one central rule rather than a special case in every action.
  if (profile.role === "platform_owner") return profile;

  const ctx = await getCentreRoleContext(profile);
  if (!can(ctx.roles, capability, ctx.overrides)) {
    throw new Error("Your role at this centre does not allow that.");
  }
  return profile;
}

/**
 * The same check, for actions a TRAINER may also perform.
 *
 * Most course-level actions -- forming subgroups, inviting candidates,
 * editing the roster, assigning tutors -- were gated
 * `requireRole(["trainer", "admin"])`, because a tutor genuinely does these
 * on their own course. A trainer holds no centre role at all, so requiring a
 * centre capability outright would have blocked the very people the action
 * exists for, and traded a permissions hole for a broken workflow.
 *
 * So the trainer path is untouched and the admin path is tightened: an
 * admin now needs the capability their role actually grants, rather than
 * passing on the strength of the flat `admin` value that every member of
 * the family shares -- read-only Centre observer included.
 *
 * Course-scoped enforcement for trainers is a separate question, handled
 * where it already is (course_tutors membership); this only decides who may
 * reach the action at all.
 */
export async function requireCapabilityOrTrainer(capability: string) {
  const profile = await requireRole(["trainer", "admin"]);
  if (profile.role === "trainer" || profile.role === "platform_owner") return profile;

  const ctx = await getCentreRoleContext(profile);
  if (!can(ctx.roles, capability, ctx.overrides)) {
    throw new Error("Your role at this centre does not allow that.");
  }
  return profile;
}
