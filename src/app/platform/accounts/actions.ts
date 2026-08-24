"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export interface UpsertSubscriptionState {
  error?: string;
  notice?: string;
}

const SUBSCRIPTION_STATUSES = ["trial", "active", "past_due", "cancelled"] as const;

/**
 * No payment provider is wired anywhere in this ecosystem yet (per
 * specs/for-claude-code-command-center-belongs-in-connect.md) -- this is
 * hand-entered, same "never auto-confirmed, always marked by a named
 * person" shape as the existing payments system. One row per centre
 * (centre_subscriptions.center_id is unique), so this both creates and
 * edits depending on whether one already exists.
 */
export async function upsertSubscription(_prev: UpsertSubscriptionState, formData: FormData): Promise<UpsertSubscriptionState> {
  const profile = await requireRole("platform_owner");

  const centerId = formData.get("center_id") as string | null;
  const planName = (formData.get("plan_name") as string | null)?.trim();
  const monthlyAmount = Number(formData.get("monthly_amount"));
  const currency = (formData.get("currency") as string | null)?.trim().toUpperCase();
  const status = formData.get("status") as string | null;
  const renewalDate = (formData.get("renewal_date") as string | null) || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!centerId) return { error: "Pick a centre." };
  if (!planName) return { error: "Give the plan a name." };
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) return { error: "Monthly amount must be a positive number." };
  if (!currency) return { error: "Give the currency (e.g. GBP, USD)." };
  if (!status || !SUBSCRIPTION_STATUSES.includes(status as (typeof SUBSCRIPTION_STATUSES)[number])) return { error: "Pick a status." };
  const validStatus = status as (typeof SUBSCRIPTION_STATUSES)[number];

  const admin = createAdminClient();
  const { error } = await admin.from("centre_subscriptions").upsert(
    {
      center_id: centerId,
      plan_name: planName,
      monthly_amount: monthlyAmount,
      currency,
      status: validStatus,
      renewal_date: renewalDate,
      notes,
      marked_by: profile.id,
    },
    { onConflict: "center_id" },
  );
  if (error) return { error: `Could not save that subscription: ${error.message}` };

  revalidatePath("/platform/accounts");
  return { notice: "Subscription saved." };
}

export interface RecordInvoiceState {
  error?: string;
  notice?: string;
}

export async function recordInvoice(_prev: RecordInvoiceState, formData: FormData): Promise<RecordInvoiceState> {
  const profile = await requireRole("platform_owner");

  const centerId = formData.get("center_id") as string | null;
  const amount = Number(formData.get("amount"));
  const currency = (formData.get("currency") as string | null)?.trim().toUpperCase();
  const dueDate = (formData.get("due_date") as string | null) || null;
  const note = (formData.get("note") as string | null)?.trim() || null;

  if (!centerId) return { error: "Pick a centre." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Amount must be a positive number." };
  if (!currency) return { error: "Give the currency (e.g. GBP, USD)." };

  const admin = createAdminClient();
  const { data: sub } = await admin.from("centre_subscriptions").select("id").eq("center_id", centerId).maybeSingle();

  const { error } = await admin.from("centre_invoices").insert({
    center_id: centerId,
    centre_subscription_id: sub?.id ?? null,
    amount,
    currency,
    due_date: dueDate,
    note,
    marked_by: profile.id,
  });
  if (error) return { error: `Could not record that invoice: ${error.message}` };

  revalidatePath("/platform/accounts");
  return { notice: "Invoice recorded." };
}

export async function markInvoicePaid(invoiceId: string) {
  const profile = await requireRole("platform_owner");
  const admin = createAdminClient();
  const { error } = await admin
    .from("centre_invoices")
    .update({ status: "paid", paid_at: new Date().toISOString(), marked_by: profile.id })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);
  revalidatePath("/platform/accounts");
}

export async function markInvoiceVoid(invoiceId: string) {
  const profile = await requireRole("platform_owner");
  const admin = createAdminClient();
  const { error } = await admin
    .from("centre_invoices")
    .update({ status: "void", marked_by: profile.id })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);
  revalidatePath("/platform/accounts");
}
