import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// "After 7 days the working copy is automatically and permanently deleted;
// the Drive archive becomes the sole record." Only ever runs on a course
// whose receipt was actually signed (status='grace_period') and whose 7
// days are up -- the grace period, not the export, is what gates this.
//
// Deletes candidate ACCOUNTS (auth.users, which profiles.id references
// on delete cascade, which in turn every trainee-owned table -- tp_plans,
// assignments, celta5_records, etc. -- references the same way, confirmed
// consistent across every migration). Trainers are never touched here:
// "a tutor is deactivated, never deleted. Everything they wrote or signed
// keeps their name permanently." The course row, timetable, resources, and
// coursebooks stay too -- those are centre-level reusable shell, not
// candidate data, and nothing in the spec asks for the course itself to be
// deleted, only the people and their access.
async function wipeOneCourse(admin: ReturnType<typeof createAdminClient>, courseId: string): Promise<void> {
  const { data: trainees } = await admin.from("profiles").select("id").eq("course_id", courseId).eq("role", "trainee");

  for (const trainee of trainees ?? []) {
    await admin.auth.admin.deleteUser(trainee.id);
  }

  // "What does not carry: chat, links, workspace URL" -- volunteer/assessor/
  // register-viewer links for this course stop working, and volunteer
  // student records (name-only, not real accounts) go with them.
  await admin.from("course_access_tokens").delete().eq("course_id", courseId);
  await admin.from("volunteer_students").delete().eq("course_id", courseId);

  await admin
    .from("course_close_outs")
    .update({ status: "wiped", wiped_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("course_id", courseId);
}

export interface CloseOutWipeRunResult {
  wiped: string[];
  errors: { courseId: string; error: string }[];
}

export async function runDueCloseOutWipes(): Promise<CloseOutWipeRunResult> {
  const admin = createAdminClient();
  const { data: due } = await admin
    .from("course_close_outs")
    .select("course_id")
    .eq("status", "grace_period")
    .lte("grace_period_ends_at", new Date().toISOString());

  const wiped: string[] = [];
  const errors: { courseId: string; error: string }[] = [];

  for (const row of due ?? []) {
    try {
      await wipeOneCourse(admin, row.course_id);
      wiped.push(row.course_id);
    } catch (err) {
      errors.push({ courseId: row.course_id, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return { wiped, errors };
}
