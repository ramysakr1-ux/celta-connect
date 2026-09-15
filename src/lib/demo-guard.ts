import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedCenter } from "@/lib/supabase/cached-queries";

/**
 * The shared demo promises that nothing is saved. Say so before writing.
 *
 * Migration 0079 blocks writes to a demo centre with a database trigger, and
 * the demo's whole safety claim rests on it: "every write genuinely blocked
 * at the database layer, not just hidden in the UI." But that trigger only
 * fires for `auth.role() = 'authenticated'` -- it deliberately exempts the
 * service role so the seed can write the demo in the first place.
 *
 * Every action that goes through createAdminClient() therefore writes as the
 * service role and walks straight past it. That was one action when the
 * trigger was written; it is 218 writes across 74 files now, because the
 * capability matrix lives in TypeScript and RLS cannot see it, so the app has
 * moved write after write to the admin client for exactly that reason.
 *
 * It surfaced once before, on 12 Sep 2026, when "Run verification" on the
 * demo course wrote a verification report for keeps -- and was fixed at that
 * one call site. This is that fix, made shareable, in the trigger's own
 * words (walked 15 Sep 2026).
 *
 * Returns the refusal message, or null when the write may proceed.
 */
export const DEMO_REFUSAL = "This is a shared demo -- changes are not saved.";

export async function refuseIfDemoCentre(centerId: string | null | undefined): Promise<string | null> {
  if (!centerId) return null;
  const centre = await getCachedCenter(centerId);
  return centre?.is_demo ? DEMO_REFUSAL : null;
}

export async function refuseIfDemoCourse(courseId: string | null | undefined): Promise<string | null> {
  if (!courseId) return null;
  const { data: course } = await createAdminClient().from("courses").select("center_id").eq("id", courseId).maybeSingle();
  return refuseIfDemoCentre(course?.center_id);
}
