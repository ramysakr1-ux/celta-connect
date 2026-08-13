"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCloseOutBlockingReasons } from "@/lib/course-close-out/blocking-rules";
import { verifyCourseForCloseOut } from "@/lib/course-close-out/verify";
import { exportCourseToDrive } from "@/lib/course-close-out/export";

export interface FormState {
  error: string | null;
}

// One of close-out's three blocking rules -- "Cambridge has not confirmed
// final grades" -- is the centre's own judgement, never computed by the
// app. A plain toggle, same spirit as deferral_transfers.hours_carried.
export async function toggleCambridgeGradesConfirmed(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const courseId = formData.get("course_id");
  if (typeof courseId !== "string") return;

  const course = await loadOwnedCourse(courseId, admin.center_id);
  if (!course) return;

  const supabase = await createClient();
  const { data: current } = await supabase.from("courses").select("cambridge_grades_confirmed_at").eq("id", courseId).single();

  await supabase
    .from("courses")
    .update(
      current?.cambridge_grades_confirmed_at
        ? { cambridge_grades_confirmed_at: null, cambridge_grades_confirmed_by: null }
        : { cambridge_grades_confirmed_at: new Date().toISOString(), cambridge_grades_confirmed_by: admin.id }
    )
    .eq("id", courseId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
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

// Runs the blocking-rule check again server-side (never trust the button
// being disabled client-side as the real authorization) and, if clear,
// creates/resets the course's close_out row and runs the technical
// verification pass synchronously. One admin click; the whole check-and-
// verify round trip is fast (DB reads only, no Drive calls yet).
export async function initiateCloseOut(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const courseId = formData.get("course_id");
  if (typeof courseId !== "string" || !courseId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const course = await loadOwnedCourse(courseId, admin.center_id);
  if (!course) return { error: "Course not found." };

  const blockingReasons = await getCloseOutBlockingReasons(courseId);
  if (blockingReasons.length > 0) {
    return { error: blockingReasons.map((r) => r.message).join(" ") };
  }

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
      center_id: admin.center_id,
      status: "verifying",
      created_by: admin.id,
    });
  }

  const report = await verifyCourseForCloseOut(courseId);
  await adminClient
    .from("course_close_outs")
    .update({
      status: report.issues.length > 0 ? "verify_failed" : "ready_to_export",
      verification_report: report,
      verified_at: new Date().toISOString(),
      verified_by: admin.id,
      updated_at: new Date().toISOString(),
    })
    .eq("course_id", courseId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  return { error: null };
}

// "Nothing is wiped until this signed receipt returns -- this is the actual
// trigger for the wipe, not the push itself." Kept to the spec's tone (a
// warm confirmation, not a legal e-sign product): the signer types their
// name, the app timestamps it. Moves straight to grace_period rather than
// lingering in a separate signed-but-not-yet-in-grace state, since
// receipt_signed_at/name are themselves the audit trail.
export async function confirmCloseOutReceipt(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const courseId = formData.get("course_id");
  const signedName = formData.get("signed_name");
  if (typeof courseId !== "string" || !courseId) {
    return { error: "Something went wrong. Refresh and try again." };
  }
  if (typeof signedName !== "string" || !signedName.trim()) {
    return { error: "Type your name to confirm receipt." };
  }

  const course = await loadOwnedCourse(courseId, admin.center_id);
  if (!course) return { error: "Course not found." };

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
      receipt_signed_by: admin.id,
      grace_period_ends_at: gracePeriodEnds.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("course_id", courseId);

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  return { error: null };
}

// Writes the whole course to the centre's Drive. Only reachable once
// verification has passed (status='ready_to_export') -- re-checked here,
// not just trusted from the UI's disabled state.
export async function exportCloseOut(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const courseId = formData.get("course_id");
  if (typeof courseId !== "string" || !courseId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const course = await loadOwnedCourse(courseId, admin.center_id);
  if (!course) return { error: "Course not found." };

  const adminClient = createAdminClient();
  const { data: closeOut } = await adminClient.from("course_close_outs").select("status").eq("course_id", courseId).maybeSingle();
  if (!closeOut || closeOut.status !== "ready_to_export") {
    return { error: "Run verification first." };
  }

  try {
    await exportCourseToDrive(courseId, admin.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Export failed. Try again." };
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  return { error: null };
}
