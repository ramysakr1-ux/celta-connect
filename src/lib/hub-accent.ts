import "server-only";
import { getCourseTutorRole } from "@/lib/course-tutor-role";

// design_handoff_trainer_homepage_v4, Design Tokens: "MCT accent -- garnet
// oklch(42% 0.13 27), deep oklch(36% 0.12 27); ACT accent -- gold
// oklch(60% 0.11 70), deep oklch(50% 0.11 65)". An assessor session, which
// v4 does not restyle, keeps Connect's teal.
//
// Lifted out of the (hub) layout on 6 Sep 2026 so a page OUTSIDE the hub can
// carry the same role colour when a tutor opens it from inside the hub --
// the input sessions library is the first, reached from the Resource hub's
// own card. One definition, so the two can never drift apart.
export const HUB_GARNET = "oklch(42% 0.13 27)";
export const HUB_GARNET_DEEP = "oklch(36% 0.12 27)";
export const HUB_GOLD = "oklch(60% 0.11 70)";
export const HUB_GOLD_DEEP = "oklch(50% 0.11 65)";
export const HUB_TEAL = "oklch(37.5% 0.058 195)"; // = --color-primary

/**
 * The role accent for a viewer on a shared page, or null when they have no
 * role colour at all -- a candidate, or anyone without a course open. Null
 * means "change nothing": the page keeps the platform's own teal, which is
 * what a candidate should see, since role colour is the tutor's identity and
 * says nothing to them.
 *
 * Costs one round trip for a tutor (cache()'d, and shared with any other
 * caller in the same request) and none for a candidate.
 */
export async function viewerHubAccent(
  profile: { id: string; role: string; course_id: string | null } | null
): Promise<{ accent: string; accentDeep: string } | null> {
  if (!profile?.course_id) return null;
  if (profile.role === "admin") return { accent: HUB_GARNET, accentDeep: HUB_GARNET_DEEP };
  if (profile.role !== "trainer" && profile.role !== "platform_owner") return null;
  const isMct = (await getCourseTutorRole(profile.course_id, profile.id)) === "main_course_tutor";
  return isMct ? { accent: HUB_GARNET, accentDeep: HUB_GARNET_DEEP } : { accent: HUB_GOLD, accentDeep: HUB_GOLD_DEEP };
}
