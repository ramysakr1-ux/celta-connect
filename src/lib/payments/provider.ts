import "server-only";

// "Design the integration behind a generic 'payment provider' interface...
// so swapping Stripe for another provider later doesn't touch the UI or
// the payments-task logic." Everything outside this file and the
// provider-specific adapter (stripe-adapter.ts) works only in terms of
// these types -- no `import Stripe` anywhere else in the app.

export type NormalizedPaymentEventType = "payment_succeeded" | "payment_failed" | "refunded";

export interface NormalizedPaymentEvent {
  type: NormalizedPaymentEventType;
  providerEventId: string;
  providerTransactionId: string;
  amount: number;
  currency: string;
  /** Round-tripped from the checkout session's metadata -- how the event maps back to a `payments` row. */
  paymentId: string | null;
}

export interface PaymentProviderAdapter {
  readonly name: string;

  /** Creates a hosted checkout page for one instalment; returns the URL to send the applicant. */
  createCheckoutSession(input: {
    paymentId: string;
    amount: number;
    currency: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ checkoutUrl: string }>;

  /**
   * Verifies the webhook came from the real provider and parses it into a
   * normalized event, or returns null for an event type this app doesn't
   * act on (the provider sends many event types Connect has no use for).
   * Throws if the signature is invalid.
   */
  parseWebhookEvent(rawBody: string, signatureHeader: string): NormalizedPaymentEvent | null;
}

// Only place in the app that knows which concrete adapter is active -- server
// actions and the webhook route call this, never `stripeAdapter` directly.
//
// Reads the centre's own choice (centers.payment_provider, migration 0106)
// rather than being hardcoded: "only one provider can be connected at a time
// per centre." Adding a provider means writing its adapter and adding a case
// here -- nothing in the UI or the payments-task logic changes.
export async function getActivePaymentProvider(centerId?: string): Promise<PaymentProviderAdapter> {
  let chosen: string | null = "stripe";

  if (centerId) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("centers")
      .select("payment_provider, payment_provider_connected_at")
      .eq("id", centerId)
      .maybeSingle();
    // A selected-but-not-connected provider is not usable -- the centre picked
    // it and never finished onboarding, so refusing here is more honest than
    // sending an applicant to a checkout that cannot complete.
    chosen = data?.payment_provider_connected_at ? data.payment_provider : null;
  }

  if (chosen === "stripe") {
    const { stripeAdapter } = await import("@/lib/payments/stripe-adapter");
    return stripeAdapter;
  }

  throw new Error(
    chosen
      ? `No integration exists for ${chosen} yet, so card payment is unavailable. The centre's other payment methods are unaffected.`
      : "This centre has no payment provider connected, so card payment is unavailable. Connect one under Centre settings, or take payment by bank transfer, cash or invoice."
  );
}
