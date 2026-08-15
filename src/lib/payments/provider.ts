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

// Only place in the app that knows which concrete adapter is active --
// server actions and the webhook route call this, never `stripeAdapter`
// directly. Swapping providers later means adding a new adapter file and
// changing this one line, not touching UI or payments-task logic.
export async function getActivePaymentProvider(): Promise<PaymentProviderAdapter> {
  const { stripeAdapter } = await import("@/lib/payments/stripe-adapter");
  return stripeAdapter;
}
