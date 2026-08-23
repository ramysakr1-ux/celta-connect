"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { PAYMENT_PROVIDERS, providerByKey } from "@/lib/payments/providers";

export interface ConnectProviderState {
  error?: string;
  notice?: string;
}

/**
 * Records which provider this centre uses, and marks it connected.
 *
 * Nothing secret passes through here. "Connect never stores or transmits card
 * numbers, bank details, or any PCI-scope data" -- the centre onboards with the
 * provider directly (KYC included) and this only wires the acceptance email's
 * Pay link to that account.
 *
 * "Only one provider can be connected at a time per centre" -- so this
 * overwrites rather than accumulating, and switching is a deliberate
 * re-connect.
 */
export async function connectProvider(_prev: ConnectProviderState, formData: FormData): Promise<ConnectProviderState> {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  // Choosing who takes the centre's money is squarely a settings change.
  if (!can(ctx.roles, "centre.settings.edit", ctx.overrides)) {
    return { error: "Your role can't change payment settings." };
  }

  const key = formData.get("provider") as string | null;
  const provider = providerByKey(key);
  if (!provider) return { error: "Pick a provider." };

  const centerId = ctx.activeCenterId ?? profile.center_id;

  // Honest refusal rather than a button that appears to work: only Stripe has
  // an adapter, and connecting a provider the app cannot then talk to would
  // leave the centre believing card payment is live when the Pay link would
  // fail. The choice is still saved so the intent isn't lost.
  if (!provider.adapter) {
    const admin = createAdminClient();
    await admin.from("centers").update({ payment_provider: provider.key, payment_provider_connected_at: null }).eq("id", centerId);
    revalidatePath("/centre/payments");
    return {
      notice: `${provider.name} selected, but Connect has no integration for it yet — card payment stays unavailable until one is built. Bank transfer, cash and invoice are unaffected.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("centers")
    .update({
      payment_provider: provider.key,
      payment_provider_connected_at: new Date().toISOString(),
      payment_provider_connected_by: profile.id,
    })
    .eq("id", centerId);
  if (error) return { error: `Could not save that: ${error.message}` };

  revalidatePath("/centre/payments");
  return { notice: `${provider.name} connected for this centre.` };
}

export async function disconnectProvider(_prev: ConnectProviderState, formData: FormData): Promise<ConnectProviderState> {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  if (!can(ctx.roles, "centre.settings.edit", ctx.overrides)) {
    return { error: "Your role can't change payment settings." };
  }
  void formData;

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const supabase = await createClient();
  const { error } = await supabase
    .from("centers")
    .update({ payment_provider: null, payment_provider_connected_at: null, payment_provider_connected_by: null })
    .eq("id", centerId);
  if (error) return { error: "Could not disconnect." };

  revalidatePath("/centre/payments");
  return { notice: "Disconnected. Card payment is off; the other three methods are unaffected." };
}

export const ALL_PROVIDERS = PAYMENT_PROVIDERS;
