import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CloseOutVerificationIssue, CloseOutVerificationReport } from "@/lib/supabase/types";

// course_lifecycle_signup_handoff spec: "confirm every candidate has a
// folder and every expected document is present *and opens* (not zero-byte/
// half-uploaded). A byte-size comparison is only a friendly first glance,
// not proof." In this app almost every "document" is rendered fresh from
// DB rows at export time (not a pre-existing file), so "present and opens"
// mostly means: the DB rows the PDF generator needs actually exist, so
// generation won't silently produce a blank/incomplete page. The one place
// real uploaded files are involved -- tp_materials -- gets an actual
// Storage existence + size check, not just a DB row check.
export async function verifyCourseForCloseOut(courseId: string): Promise<CloseOutVerificationReport> {
  const admin = createAdminClient();
  const issues: CloseOutVerificationIssue[] = [];

  const { data: trainees } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("course_id", courseId)
    .eq("role", "trainee");

  const candidates = trainees ?? [];

  for (const trainee of candidates) {
    const { data: taughtTps } = await admin
      .from("plan_assignments")
      .select("tp_number")
      .eq("course_id", courseId)
      .eq("trainee_id", trainee.id)
      .not("taught_at", "is", null);

    for (const { tp_number } of taughtTps ?? []) {
      // Mirrors the exact gate src/app/api/tp-plans/[planId]/pdf/route.ts
      // applies before it will render a TP record -- plan, self-eval, and
      // feedback all need submitted_at set, not just to exist as rows.
      const { data: plan } = await admin
        .from("tp_plans")
        .select("id, submitted_at")
        .eq("course_id", courseId)
        .eq("trainee_id", trainee.id)
        .eq("tp_number", tp_number)
        .maybeSingle();

      if (!plan) {
        issues.push({
          traineeId: trainee.id,
          traineeName: trainee.full_name,
          artifact: `TP${tp_number} lesson plan`,
          problem: "Marked as taught but no lesson plan was ever saved.",
        });
        continue;
      }
      if (!plan.submitted_at) {
        issues.push({
          traineeId: trainee.id,
          traineeName: trainee.full_name,
          artifact: `TP${tp_number} lesson plan`,
          problem: "Lesson plan was never submitted.",
        });
      }

      const { data: selfEval } = await admin
        .from("tp_self_evaluations")
        .select("submitted_at")
        .eq("tp_plan_id", plan.id)
        .maybeSingle();

      if (!selfEval?.submitted_at) {
        issues.push({
          traineeId: trainee.id,
          traineeName: trainee.full_name,
          artifact: `TP${tp_number} self-evaluation`,
          problem: "Marked as taught but no self-evaluation was ever submitted.",
        });
      }

      const { data: feedback } = await admin
        .from("tp_feedback")
        .select("id, submitted_at")
        .eq("tp_plan_id", plan.id)
        .maybeSingle();

      if (!feedback?.submitted_at) {
        issues.push({
          traineeId: trainee.id,
          traineeName: trainee.full_name,
          artifact: `TP${tp_number} feedback`,
          problem: "Marked as taught but no feedback was ever submitted.",
        });
      }

      const { data: materials } = await admin
        .from("tp_materials")
        .select("id, storage_path, file_name")
        .eq("tp_plan_id", plan.id)
        .not("storage_path", "is", null);

      for (const material of materials ?? []) {
        if (!material.storage_path) continue;
        const folder = material.storage_path.split("/").slice(0, -1).join("/");
        const filename = material.storage_path.split("/").pop();
        const { data: listing } = await admin.storage.from("tp-materials").list(folder);
        const found = listing?.find((f) => f.name === filename);
        if (!found || (found.metadata?.size ?? 0) === 0) {
          issues.push({
            traineeId: trainee.id,
            traineeName: trainee.full_name,
            artifact: `TP${tp_number} material "${material.file_name ?? filename}"`,
            problem: found ? "File exists but is zero bytes." : "File is missing from storage.",
          });
        }
      }
    }

    const { data: celta5 } = await admin
      .from("celta5_records")
      .select("id")
      .eq("course_id", courseId)
      .eq("trainee_id", trainee.id)
      .maybeSingle();

    if (!celta5) {
      issues.push({
        traineeId: trainee.id,
        traineeName: trainee.full_name,
        artifact: "CELTA 5 record",
        problem: "No CELTA 5 record exists for this candidate yet.",
      });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    candidateCount: candidates.length,
    issues,
  };
}
