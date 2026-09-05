import "server-only";
import { cookies } from "next/headers";
import { isMctOfCourse } from "@/lib/course-tutor-role";
import type { Database } from "@/lib/supabase/types";

type Profile = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "role" | "course_id">;

// MCT → ACT preview (Ramy, 5 Sep 2026: "let it go one way... across the
// platform"). A cookie the real MCT can set and clear from the header's
// role pill; DISPLAY scoping reads it through isMctView below, write
// actions never do -- they keep calling isMctOfCourse directly, so the
// preview can hide a control but can never weaken a permission. One
// direction only: an ACT has no equivalent, the MCT view is a permission,
// not a view.
export const ACT_PREVIEW_COOKIE = "act_preview";

export async function isActPreview(): Promise<boolean> {
  return (await cookies()).get(ACT_PREVIEW_COOKIE)?.value === "1";
}

/**
 * What the pages use to decide what to SHOW. Real MCT with the preview
 * cookie on reads as not-MCT everywhere this is called.
 */
export async function isMctView(trainer: Profile, courseId: string): Promise<boolean> {
  const real = await isMctOfCourse(trainer, courseId);
  if (!real) return false;
  return !(await isActPreview());
}
