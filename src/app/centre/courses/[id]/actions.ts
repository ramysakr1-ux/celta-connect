"use server";

import { demoOr } from "@/lib/demo-guard";
import "server-only";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { canAtCentre } from "@/lib/auth/centre-roles";
import { createAdminClient } from "@/lib/supabase/admin";

export interface FormState {
  error: string | null;
}

// for-claude-code-course-admin-scope-reduction.md: "Capacity and pricing...
// belongs to Centre Admin, not Course Admin." Moved off the new-course
// wizard (src/app/dashboard/admin/create-course-form.tsx) to here -- the
// courses.fee_amount/deposit_amount/etc. columns are unchanged and still
// what the offer email reads, just set from a different screen now.
export async function updateCoursePricing(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) return { error: "Not signed in." };

  const courseId = formData.get("course_id");
  if (typeof courseId !== "string") return { error: "Missing course." };

  const feeRaw = (formData.get("fee_amount") as string | null) || null;
  const depositRaw = (formData.get("deposit_amount") as string | null) || null;
  const feeCurrency = (formData.get("fee_currency") as string | null)?.trim().toUpperCase() || null;
  const depositDueRaw = (formData.get("deposit_due_days") as string | null) || null;

  const feeAmount = feeRaw ? Number(feeRaw) : null;
  const depositAmount = depositRaw ? Number(depositRaw) : null;
  const depositDueDays = depositDueRaw ? Number(depositDueRaw) : null;
  if ((feeAmount !== null && !(feeAmount >= 0)) || (depositAmount !== null && !(depositAmount >= 0))) {
    return { error: "Fee and deposit should be amounts." };
  }
  if (depositDueDays !== null && (!Number.isInteger(depositDueDays) || depositDueDays <= 0)) {
    return { error: "Deposit due should be a number of days." };
  }

  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("center_id").eq("id", courseId).maybeSingle();
  if (!course) return { error: "Course not found." };
  // for-claude-code-centre-role-rename-and-payments-fix.md §2: payments.edit,
  // not course.editRecord -- this writes fee/deposit fields, and Course
  // administrator holds course.editRecord without any payments access.
  //
  // Asked at the COURSE's centre. It used to check the capability wherever
  // this person happened to be acting and then accept any course at any
  // branch they could switch into (walked 15 Sep 2026).
  if (!(await canAtCentre(profile, "payments.edit", course.center_id))) return { error: "You can't edit payments." };

  const { error } = await admin
    .from("courses")
    .update({ fee_amount: feeAmount, deposit_amount: depositAmount, fee_currency: feeCurrency, deposit_due_days: depositDueDays })
    .eq("id", courseId);
  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[centre/courses/[id]:updateCoursePricing]", error);
    return { error: demoOr(error, "Could not save. Try again.") };
  }

  revalidatePath(`/centre/courses/${courseId}`);
  return { error: null };
}

/**
 * The cohort cap, after the course exists.
 *
 * Ramy, 18 Sep 2026: "quite often you don't know how many trainees will be on
 * the course... if it's a course of 12, I can go back and make it a course of
 * 18 if I want to." It was asked once in the new-course wizard and then held
 * for the life of the course with no way to change it, while Admissions kept
 * counting places against it.
 *
 * Capacity is Centre Admin's, same as pricing, but it is the course record
 * rather than money -- so course.editRecord, not payments.edit. Asked at the
 * COURSE's centre, not wherever this person happens to be standing.
 */
export async function updateCourseCohortSize(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) return { error: "Not signed in." };

  const courseId = formData.get("course_id");
  if (typeof courseId !== "string") return { error: "Missing course." };

  const raw = (formData.get("cohort_size") as string | null)?.trim() || null;
  const cohortSize = raw ? Number(raw) : null;
  if (cohortSize !== null && (!Number.isInteger(cohortSize) || cohortSize <= 0)) {
    return { error: "Maximum cohort should be a whole number." };
  }
  // Handbook 7.1, the same ceiling the wizard refuses at creation.
  if (cohortSize !== null && cohortSize > 24) {
    return { error: "The maximum cohort on a CELTA course is 24 (Handbook 7.1)." };
  }

  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("center_id").eq("id", courseId).maybeSingle();
  if (!course) return { error: "Course not found." };
  if (!(await canAtCentre(profile, "course.editRecord", course.center_id))) {
    return { error: "You can't edit this course." };
  }

  // Lowering the cap below the people already on the course would leave
  // Admissions reporting negative places and the roster over capacity, with
  // nothing on screen explaining either. Say so instead.
  if (cohortSize !== null) {
    // The same count the page shows: profiles on this course with the
    // trainee role. There is no course_trainees table.
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("role", "trainee");
    if ((count ?? 0) > cohortSize) {
      return { error: `${count} candidates are already on this course. Remove some first, or set the maximum to ${count} or more.` };
    }
  }

  const { error } = await admin.from("courses").update({ cohort_size: cohortSize }).eq("id", courseId);
  if (error) {
    console.error("[centre/courses/[id]:updateCourseCohortSize]", error);
    return { error: demoOr(error, "Could not save. Try again.") };
  }

  revalidatePath(`/centre/courses/${courseId}`);
  revalidatePath("/dashboard/admissions");
  return { error: null };
}
