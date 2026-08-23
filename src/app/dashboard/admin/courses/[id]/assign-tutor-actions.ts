"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { isMctOnCourse } from "@/lib/course-mct";
import { TUTOR_ROLES, type TutorRole } from "@/lib/tutor-roles";
import { checkConcurrentCourseAssignment, type CourseWindow } from "@/lib/concurrent-course-check";

// for-claude-code-concurrent-course-checks.md: "assigning a trainer to a
// second course adds to their assignments -- it does not remove them from
// the first." This is that add path -- course_tutors' own migration comment
// (0051) flagged it as deliberately not built there: "the actual admin UI
// to search for an existing tutor... and add them to a new course."

export interface AssignTutorState {
  error: string | null;
  warning?: string | null;
  assigned?: string | null;
}

export async function assignExistingTutor(_prev: AssignTutorState, formData: FormData): Promise<AssignTutorState> {
  const admin = await requireRole(["admin", "trainer"]);
  const courseId = formData.get("course_id");
  const profileId = formData.get("profile_id");
  const tutorRoleRaw = formData.get("tutor_role");

  if (typeof courseId !== "string" || typeof profileId !== "string") return { error: "Something went wrong." };
  if (typeof tutorRoleRaw !== "string" || !TUTOR_ROLES.includes(tutorRoleRaw as TutorRole)) {
    return { error: "Choose the role they'll hold on this course." };
  }
  const tutorRole = tutorRoleRaw as TutorRole;

  const adminClient = createAdminClient();

  const { data: targetCourse } = await adminClient
    .from("courses")
    .select("id, center_id, is_part_time, start_date, end_date")
    .eq("id", courseId)
    .maybeSingle();
  if (!targetCourse || targetCourse.center_id !== admin.center_id) return { error: "Course not found." };
  if (admin.role === "trainer" && !(await isMctOnCourse(adminClient, courseId, admin.id))) {
    return { error: "Only the main course tutor can do this." };
  }

  // Same centre only -- both Handbook rules this check exists for (2.4 and
  // 12.3) are scoped that way, per for-claude-code-concurrent-course-checks.md.
  const { data: trainer } = await adminClient
    .from("profiles")
    .select("id, full_name, role, center_id")
    .eq("id", profileId)
    .maybeSingle();
  if (!trainer || trainer.role !== "trainer" || trainer.center_id !== admin.center_id) {
    return { error: "That person isn't a tutor at this centre." };
  }

  if (tutorRole === "main_course_tutor") {
    const { data: existingMct } = await adminClient
      .from("course_tutors")
      .select("profile_id")
      .eq("course_id", courseId)
      .eq("tutor_role", "main_course_tutor")
      .is("left_at", null)
      .maybeSingle();
    if (existingMct) {
      const { data: who } = await adminClient.from("profiles").select("full_name").eq("id", existingMct.profile_id).maybeSingle();
      return { error: `${who?.full_name ?? "Someone"} is already the main course tutor. Change their role first.` };
    }
  }

  // Handbook 2.4's FT/FT-blocked, FT/PT-allowed rule applies to a tutor
  // "engaged to work" -- an assessor is a different rule (12.3, visible-only,
  // not enforced here), and trainee/TinT involvement and a not-yet-set role
  // are exempt per the resolution doc's own carve-outs.
  let warning: string | null = null;
  if (tutorRole !== "external_assessor") {
    const { data: activeLinks } = await adminClient
      .from("course_tutors")
      .select("course_id, tutor_role, is_trainer_in_training")
      .eq("profile_id", profileId)
      .is("left_at", null);

    const relevantLinks = (activeLinks ?? []).filter(
      (link) =>
        link.course_id !== courseId &&
        !link.is_trainer_in_training &&
        link.tutor_role &&
        link.tutor_role !== "external_assessor"
    );
    const { data: linkedCourses } =
      relevantLinks.length > 0
        ? await adminClient
            .from("courses")
            .select("id, center_id, is_part_time, start_date, end_date")
            .in("id", relevantLinks.map((l) => l.course_id))
        : { data: [] };

    const existingWindows: CourseWindow[] = (linkedCourses ?? [])
      .filter((c) => c.center_id === admin.center_id)
      .map((c) => ({ id: c.id, is_part_time: c.is_part_time, start_date: c.start_date, end_date: c.end_date }));

    const result = checkConcurrentCourseAssignment(
      { id: targetCourse.id, is_part_time: targetCourse.is_part_time, start_date: targetCourse.start_date, end_date: targetCourse.end_date },
      existingWindows
    );

    if (result.level === "blocked") return { error: result.reason };
    if (result.level === "warn") warning = result.reason;
  }

  const { error } = await adminClient
    .from("course_tutors")
    .upsert(
      { course_id: courseId, profile_id: profileId, tutor_role: tutorRole, left_at: null, joined_at: new Date().toISOString() },
      { onConflict: "course_id,profile_id" }
    );
  if (error) return { error: "Could not assign them to this course. Try again." };

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  return { error: null, warning, assigned: trainer.full_name };
}

/**
 * Ends a tutor's link to a course that isn't their home course
 * (profiles.course_id points elsewhere) -- the existing removeRosterMember
 * deletes the whole account and is guarded to only act on a person's home
 * course, so a secondary link needs its own, non-destructive removal: mark
 * the course_tutors row left, leave the account and their other course
 * untouched.
 */
export async function leaveSecondaryCourse(formData: FormData): Promise<void> {
  const admin = await requireRole(["admin", "trainer"]);
  const courseId = formData.get("course_id");
  const profileId = formData.get("profile_id");
  if (typeof courseId !== "string" || typeof profileId !== "string") return;

  const adminClient = createAdminClient();
  const { data: course } = await adminClient.from("courses").select("id, center_id").eq("id", courseId).maybeSingle();
  if (!course || course.center_id !== admin.center_id) return;
  if (admin.role === "trainer" && !(await isMctOnCourse(adminClient, courseId, admin.id))) return;

  await adminClient
    .from("course_tutors")
    .update({ left_at: new Date().toISOString() })
    .eq("course_id", courseId)
    .eq("profile_id", profileId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
}
