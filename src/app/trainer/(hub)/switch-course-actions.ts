"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/get-profile";

// for-claude-code-course-switcher.md: "one active course context at a
// time -- like switching tabs, not two live sessions open together." This
// just moves which course profiles.course_id (== current_course_id() in
// every RLS policy) points at; the trainer's link to the course they're
// leaving is untouched.
//
// course_tutors' own SELECT policy only lets a trainer read rows where
// course_id = current_course_id() -- exactly the row this needs to check
// (the one for the course they're switching TO, not the one they're
// currently on), so this has to go through the admin client rather than
// the RLS-bound one.
export interface SwitchCourseState {
  error: string | null;
}

export async function switchActiveCourse(courseId: string): Promise<SwitchCourseState> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile || (profile.role !== "trainer" && profile.role !== "platform_owner")) return { error: "Not allowed." };
  if (courseId === profile.course_id) return { error: null };

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("course_tutors")
    .select("id")
    .eq("course_id", courseId)
    .eq("profile_id", profile.id)
    .is("left_at", null)
    .maybeSingle();
  if (!link) return { error: "You're not linked to that course." };

  const { error } = await admin.from("profiles").update({ course_id: courseId }).eq("id", profile.id);
  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[trainer/(hub)/switch-course-actions.ts:switchActiveCourse]", error);
    return { error: "Could not switch courses. Try again." };
  }

  revalidatePath("/trainer", "layout");
  return { error: null };
}
