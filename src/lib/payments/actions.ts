"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmissionsHandler, canDecideAdmissions } from "@/lib/admissions-access";
import { getActivePaymentProvider } from "@/lib/payments/provider";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import type { Database } from "@/lib/supabase/types";

export interface PaymentFormState {
  error: string | null;
}

// "A payment can be split into a plan (e.g. 3 instalments) at setup."
// v1 keeps instalment spacing simple and explicit rather than a full
// scheduling UI: equal amounts (last instalment absorbs any rounding
// remainder), due dates 30 days apart starting from the staff-chosen first
// due date. Editable later if a centre needs uneven spacing.
export async function createPaymentPlan(_prevState: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const staff = await requireAdmissionsHandler();
  const applicantId = formData.get("applicant_id");
  const totalAmount = formData.get("total_amount");
  const currency = formData.get("currency");
  const instalmentCount = formData.get("instalment_count");
  const firstDueDate = formData.get("first_due_date");

  if (
    typeof applicantId !== "string" ||
    typeof totalAmount !== "string" ||
    typeof currency !== "string" ||
    typeof instalmentCount !== "string" ||
    typeof firstDueDate !== "string" ||
    !totalAmount ||
    !currency.trim() ||
    !firstDueDate
  ) {
    return { error: "Fill in the amount, currency, instalment count, and first due date." };
  }
  const total = Number(totalAmount);
  const count = Number(instalmentCount);
  if (!Number.isFinite(total) || total <= 0) return { error: "Enter a valid total amount." };
  if (!Number.isInteger(count) || count < 1 || count > 12) return { error: "Instalments must be a whole number from 1 to 12." };
  if (!canDecideAdmissions(staff)) return { error: "Only a verified course tutor or a nominated admissions decider can set up a payment plan." };

  const supabase = await createClient();
  const { data: applicant } = await supabase
    .from("applicants")
    .select("intake_course_id")
    .eq("id", applicantId)
    .eq("center_id", staff.center_id)
    .maybeSingle();
  if (!applicant) return { error: "Applicant not found." };

  const currencyCode = currency.trim().toUpperCase();
  const { data: plan, error: planError } = await supabase
    .from("payment_plans")
    .insert({
      center_id: staff.center_id,
      course_id: applicant.intake_course_id,
      applicant_id: applicantId,
      total_amount: total,
      currency: currencyCode,
      instalment_count: count,
      created_by: staff.id,
    })
    .select("id")
    .single();
  if (planError || !plan) return { error: "Could not create the payment plan. An applicant can only have one plan at a time." };

  // Equal split, last instalment absorbs the rounding remainder so the
  // instalments always sum to exactly total_amount.
  const baseAmount = Math.floor((total / count) * 100) / 100;
  const rows: Database["public"]["Tables"]["payments"]["Insert"][] = [];
  for (let i = 1; i <= count; i++) {
    const dueDate = new Date(`${firstDueDate}T00:00:00Z`);
    dueDate.setUTCDate(dueDate.getUTCDate() + 30 * (i - 1));
    const amount = i === count ? Math.round((total - baseAmount * (count - 1)) * 100) / 100 : baseAmount;
    rows.push({
      center_id: staff.center_id,
      payment_plan_id: plan.id,
      instalment_index: i,
      amount,
      currency: currencyCode,
      due_date: dueDate.toISOString().slice(0, 10),
    });
  }
  const { error: paymentsError } = await supabase.from("payments").insert(rows);
  if (paymentsError) return { error: "Plan created, but could not create its instalments. Contact support." };

  revalidatePath(`/dashboard/admissions/${applicantId}`);
  return { error: null };
}

// "Manually marked by [admin name]... never 'confirmed'." Same principle
// as the fee-tracking model it replaces, now per-instalment.
export async function markPaymentManual(formData: FormData): Promise<void> {
  const staff = await requireAdmissionsHandler();
  const paymentId = formData.get("payment_id");
  const applicantId = formData.get("applicant_id");
  const paid = formData.get("paid") === "true";
  const note = (formData.get("marked_note") as string | null)?.trim() || null;
  if (typeof paymentId !== "string" || typeof applicantId !== "string") return;
  if (!canDecideAdmissions(staff)) return;

  const supabase = await createClient();
  await supabase
    .from("payments")
    .update(
      paid
        ? { status: "paid", source: "manual", marked_by: staff.id, marked_note: note, paid_at: new Date().toISOString() }
        : { status: "pending", source: null, marked_by: null, marked_note: null, paid_at: null }
    )
    .eq("id", paymentId)
    .eq("center_id", staff.center_id);

  revalidatePath(`/dashboard/admissions/${applicantId}`);
}

// Generates a hosted checkout link for one instalment and stores it so
// staff can view/resend without regenerating. Creating the link doesn't
// mark anything paid -- that only happens when the provider's webhook
// confirms it.
export async function createProviderCheckoutLink(_prevState: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const staff = await requireAdmissionsHandler();
  const paymentId = formData.get("payment_id");
  const applicantId = formData.get("applicant_id");
  if (typeof paymentId !== "string" || typeof applicantId !== "string") return { error: "Something went wrong. Refresh and try again." };
  if (!canDecideAdmissions(staff)) return { error: "Only a verified course tutor or a nominated admissions decider can send a payment link." };

  const supabase = await createClient();
  const [{ data: payment }, { data: applicant }] = await Promise.all([
    supabase.from("payments").select("*").eq("id", paymentId).eq("center_id", staff.center_id).maybeSingle(),
    supabase.from("applicants").select("full_name, intake_course_id").eq("id", applicantId).eq("center_id", staff.center_id).maybeSingle(),
  ]);
  if (!payment || !applicant) return { error: "Payment or applicant not found." };
  if (payment.status === "paid") return { error: "This instalment is already marked paid." };

  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) return { error: "SITE_URL is missing -- cannot build the checkout return links." };

  const { data: course } = await supabase.from("courses").select("name").eq("id", applicant.intake_course_id).maybeSingle();

  try {
    // Pass the centre so the resolver reads THAT centre's connected provider
    // (migration 0106) rather than falling back to Stripe. Without this the
    // provider screen's setting would be decorative.
    const provider = await getActivePaymentProvider(staff.center_id);
    const { checkoutUrl } = await provider.createCheckoutSession({
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      description: `${course?.name ?? "Course"} -- instalment ${payment.instalment_index}`,
      successUrl: `${siteUrl}/dashboard/admissions/${applicantId}`,
      cancelUrl: `${siteUrl}/dashboard/admissions/${applicantId}`,
    });

    await supabase
      .from("payments")
      .update({ provider: provider.name, provider_checkout_url: checkoutUrl })
      .eq("id", paymentId)
      .eq("center_id", staff.center_id);

    revalidatePath(`/dashboard/admissions/${applicantId}`);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the payment link." };
  }
}

// payment_notifications (runMissedInstalmentsCron, src/lib/payments-cron.ts)
// has been writing "instalment overdue" rows -- read_at included -- since
// before this session, with nothing anywhere reading them back. First
// reader: the panel on /centre/payments. Dismiss just sets read_at; the
// row stays for the record, it just stops surfacing as outstanding.
export async function markPaymentNotificationRead(formData: FormData): Promise<void> {
  const session = await getCurrentProfile();
  if (!session?.profile) return;
  const ctx = await getCentreRoleContext(session.profile);
  if (!can(ctx.roles, "payments.edit", ctx.overrides)) return;

  const notificationId = formData.get("notification_id");
  if (typeof notificationId !== "string") return;

  const centerId = ctx.activeCenterId ?? session.profile.center_id;
  const supabase = await createClient();
  await supabase
    .from("payment_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("center_id", centerId);

  revalidatePath("/centre/payments");
}
