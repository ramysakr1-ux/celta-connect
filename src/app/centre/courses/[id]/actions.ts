"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
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
  const ctx = await getCentreRoleContext(profile);
  // for-claude-code-centre-role-rename-and-payments-fix.md §2: payments.edit,
  // not course.editRecord -- this writes fee/deposit fields, and Course
  // administrator holds course.editRecord without any payments access.
  if (!can(ctx.roles, "payments.edit", ctx.overrides)) return { error: "You can't edit payments." };

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
  if (!course || !ctx.availableCenterIds.includes(course.center_id)) return { error: "Course not found." };

  const { error } = await admin
    .from("courses")
    .update({ fee_amount: feeAmount, deposit_amount: depositAmount, fee_currency: feeCurrency, deposit_due_days: depositDueDays })
    .eq("id", courseId);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath(`/centre/courses/${courseId}`);
  return { error: null };
}
