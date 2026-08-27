"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMctOnCourse } from "@/lib/course-mct";
import { getCloseOutBlockingReasons } from "@/lib/course-close-out/blocking-rules";
import { verifyCourseForCloseOut } from "@/lib/course-close-out/verify";
import { exportCourseToDrive } from "@/lib/course-close-out/export";

export interface FormState {
  error: string | null;
}

// for-claude-code-course-admin-landing-and-admissions.md (23 Aug 2026):
// close-out is "MCT territory once the course is running, not Course
// Admin's" -- moved here from Course Admin's page 2026-08-27, reusing
// this same action file (the business logic never needed to change, only
// who's allowed to trigger it). Admin keeps full access, same convention
// as every other MCT-gated action in the trainer hub (see
// timetable/actions.ts's requireTimetableEditAccess).
const NOT_MCT_ERROR = "Only the main course tutor can run close-out.";

async function requireMctCloseOutAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainer: { role: string; id: string; course_id: string | null }
): Promise<boolean> {
  if (trainer.role === "admin" || !trainer.course_id) return true;
  return isMctOnCourse(supabase, trainer.course_id, trainer.id);
}

// One of close-out's three blocking rules -- "Cambridge has not confirmed
// final grades" -- is the centre's own judgement, never computed by the
// app. A plain toggle, same spirit as deferral_transfers.hours_carried.
export async function toggleCambridgeGradesConfirmed(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const courseId = formData.get("course_id");
  if (typeof courseId !== "string") return;

  const course = await loadOwnedCourse(courseId, trainer.center_id);
  if (!course) return;

  const supabase = await createClient();
  if (!(await requireMctCloseOutAccess(supabase, trainer))) return;
  const { data: current } = await supabase.from("courses").select("cambridge_grades_confirmed_at").eq("id", courseId).single();

  await supabase
    .from("courses")
    .update(
      current?.cambridge_grades_confirmed_at
        ? { cambridge_grades_confirmed_at: null, cambridge_grades_confirmed_by: null }
        : { cambridge_grades_confirmed_at: new Date().toISOString(), cambridge_grades_confirmed_by: trainer.id }
    )
    .eq("id", courseId);

  revalidatePath("/trainer/grades-report");
}

// build-spec.md compliance-audit item 10 (Handbook 10.5): "Certificates
// checked against the recommended grades on arrival; Cambridge contacted
// immediately on an error." The mismatch itself isn't computed here --
// CertificateCheckCard reads final_recommended_grade vs certificate_grade
// directly and shows the callout -- this action only records what arrived.
// An empty grade clears the record (the certificate arriving later, or a
// correction to what was typed).
const CERTIFICATE_GRADES = ["Pass", "Pass B", "Pass A", "Fail"] as const;
type CertificateGrade = (typeof CERTIFICATE_GRADES)[number];

export async function recordCertificateGrade(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const courseId = formData.get("course_id");
  const traineeId = formData.get("trainee_id");
  const gradeRaw = formData.get("certificate_grade");
  if (typeof courseId !== "string" || typeof traineeId !== "string") {
    return { error: "Missing candidate." };
  }
  if (gradeRaw !== null && typeof gradeRaw !== "string") return { error: "Invalid grade." };
  const grade: CertificateGrade | null =
    gradeRaw && (CERTIFICATE_GRADES as readonly string[]).includes(gradeRaw) ? (gradeRaw as CertificateGrade) : null;
  if (gradeRaw && !grade) return { error: "Invalid grade." };

  const course = await loadOwnedCourse(courseId, trainer.center_id);
  if (!course) return { error: "Course not found." };

  const supabase = await createClient();
  if (!(await requireMctCloseOutAccess(supabase, trainer))) return { error: NOT_MCT_ERROR };
  const { error } = await supabase
    .from("celta5_records")
    .update(
      grade
        ? { certificate_grade: grade, certificate_recorded_at: new Date().toISOString(), certificate_recorded_by: trainer.id }
        : { certificate_grade: null, certificate_recorded_at: null, certificate_recorded_by: null }
    )
    .eq("course_id", courseId)
    .eq("trainee_id", traineeId);
  if (error) return { error: "Could not record the certificate grade." };

  revalidatePath("/trainer/grades-report");
  return { error: null };
}

async function loadOwnedCourse(courseId: string, centerId: string) {
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, center_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || course.center_id !== centerId) return null;
  return course;
}

// build-spec.md's blocking rules ("Hold the erasure, not the export") only
// cover the actual destructive step -- verification and export are read-
// only against the source data and stay available regardless, so a centre
// isn't stuck without even an export while, say, an extension resolves
// itself. The blocking check lives on confirmCloseOutReceipt instead,
// since that's the actual trigger for the wipe (see its own comment).
export async function initiateCloseOut(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const courseId = formData.get("course_id");
  if (typeof courseId !== "string" || !courseId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const course = await loadOwnedCourse(courseId, trainer.center_id);
  if (!course) return { error: "Course not found." };

  const supabase = await createClient();
  if (!(await requireMctCloseOutAccess(supabase, trainer))) return { error: NOT_MCT_ERROR };

  const adminClient = createAdminClient();
  const { data: existing } = await adminClient
    .from("course_close_outs")
    .select("id")
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) {
    await adminClient
      .from("course_close_outs")
      .update({ status: "verifying", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await adminClient.from("course_close_outs").insert({
      course_id: courseId,
      center_id: trainer.center_id,
      status: "verifying",
      created_by: trainer.id,
    });
  }

  const report = await verifyCourseForCloseOut(courseId);
  await adminClient
    .from("course_close_outs")
    .update({
      status: report.issues.length > 0 ? "verify_failed" : "ready_to_export",
      verification_report: report,
      verified_at: new Date().toISOString(),
      verified_by: trainer.id,
      updated_at: new Date().toISOString(),
    })
    .eq("course_id", courseId);

  revalidatePath("/trainer/grades-report");
  return { error: null };
}

// "Nothing is wiped until this signed receipt returns -- this is the actual
// trigger for the wipe, not the push itself." Kept to the spec's tone (a
// warm confirmation, not a legal e-sign product): the signer types their
// name, the app timestamps it. Moves straight to grace_period rather than
// lingering in a separate signed-but-not-yet-in-grace state, since
// receipt_signed_at/name are themselves the audit trail.
//
// This is where build-spec.md's blocking rules actually apply: signing
// receipt starts the grace-period clock toward the irreversible wipe, so
// this -- not verification or export -- is "close-out" in the sense the
// rules mean. Re-checked here server-side, never trusted from the UI's
// disabled state.
export async function confirmCloseOutReceipt(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const courseId = formData.get("course_id");
  const signedName = formData.get("signed_name");
  if (typeof courseId !== "string" || !courseId) {
    return { error: "Something went wrong. Refresh and try again." };
  }
  if (typeof signedName !== "string" || !signedName.trim()) {
    return { error: "Type your name to confirm receipt." };
  }

  const course = await loadOwnedCourse(courseId, trainer.center_id);
  if (!course) return { error: "Course not found." };

  const supabase = await createClient();
  if (!(await requireMctCloseOutAccess(supabase, trainer))) return { error: NOT_MCT_ERROR };

  const blockingReasons = await getCloseOutBlockingReasons(courseId);
  if (blockingReasons.length > 0) {
    return { error: blockingReasons.map((r) => r.message).join(" ") };
  }

  const adminClient = createAdminClient();
  const { data: closeOut } = await adminClient.from("course_close_outs").select("status").eq("course_id", courseId).maybeSingle();
  if (!closeOut || closeOut.status !== "awaiting_receipt") {
    return { error: "Nothing is awaiting a receipt right now." };
  }

  const now = new Date();
  const gracePeriodEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await adminClient
    .from("course_close_outs")
    .update({
      status: "grace_period",
      receipt_signed_name: signedName.trim(),
      receipt_signed_at: now.toISOString(),
      receipt_signed_by: trainer.id,
      grace_period_ends_at: gracePeriodEnds.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("course_id", courseId);

  revalidatePath("/trainer/grades-report");
  return { error: null };
}

// for-claude-code-six-month-deletion-override.md: a manual override so a
// centre still in active dispute past the normal window can hold off the
// automatic wipe. Pushes grace_period_ends_at out rather than gating the
// wipe behind a fresh confirmation prompt -- the existing model is "trust
// the clock once receipt is signed," so this stays a delay action on that
// same clock rather than a second state machine. Logged to
// centre_owner_actions, the app's one generic append-only audit log (see
// src/app/centre/roles/actions.ts's logOwnerAction for the precedent) --
// service-role only, so the log entry can't be forged or suppressed by the
// admin who triggered it.
export async function extendGracePeriod(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const courseId = formData.get("course_id");
  const newDateRaw = formData.get("new_deletion_date");
  if (typeof courseId !== "string" || !courseId) {
    return { error: "Something went wrong. Refresh and try again." };
  }
  if (typeof newDateRaw !== "string" || !newDateRaw) {
    return { error: "Pick a new deletion date." };
  }

  const course = await loadOwnedCourse(courseId, trainer.center_id);
  if (!course) return { error: "Course not found." };

  const supabase = await createClient();
  if (!(await requireMctCloseOutAccess(supabase, trainer))) return { error: NOT_MCT_ERROR };

  const adminClient = createAdminClient();
  const { data: closeOut } = await adminClient
    .from("course_close_outs")
    .select("id, status, grace_period_ends_at")
    .eq("course_id", courseId)
    .maybeSingle();
  if (!closeOut || closeOut.status !== "grace_period") {
    return { error: "This course isn't in the deletion countdown right now." };
  }

  const newDate = new Date(`${newDateRaw}T00:00:00Z`);
  const currentEnds = closeOut.grace_period_ends_at ? new Date(closeOut.grace_period_ends_at) : new Date();
  if (Number.isNaN(newDate.getTime()) || newDate <= currentEnds) {
    return { error: "The new date must be after the current deletion date." };
  }

  await adminClient
    .from("course_close_outs")
    .update({ grace_period_ends_at: newDate.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", closeOut.id);

  await adminClient.from("centre_owner_actions").insert({
    center_id: trainer.center_id,
    actor_profile_id: trainer.id,
    action: "close_out.deletion_delayed",
    target_table: "course_close_outs",
    target_id: closeOut.id,
    detail: {
      course_id: courseId,
      previous_deletion_date: closeOut.grace_period_ends_at,
      new_deletion_date: newDate.toISOString(),
    },
  });

  revalidatePath("/trainer/grades-report");
  return { error: null };
}

// Writes the whole course to the centre's Drive. Only reachable once
// verification has passed (status='ready_to_export') -- re-checked here,
// not just trusted from the UI's disabled state.
export async function exportCloseOut(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const courseId = formData.get("course_id");
  if (typeof courseId !== "string" || !courseId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const course = await loadOwnedCourse(courseId, trainer.center_id);
  if (!course) return { error: "Course not found." };

  const supabase = await createClient();
  if (!(await requireMctCloseOutAccess(supabase, trainer))) return { error: NOT_MCT_ERROR };

  const adminClient = createAdminClient();
  const { data: closeOut } = await adminClient.from("course_close_outs").select("status").eq("course_id", courseId).maybeSingle();
  if (!closeOut || closeOut.status !== "ready_to_export") {
    return { error: "Run verification first." };
  }

  try {
    await exportCourseToDrive(courseId, trainer.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Export failed. Try again." };
  }

  revalidatePath("/trainer/grades-report");
  return { error: null };
}
