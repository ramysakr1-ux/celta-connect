import "server-only";
import Stripe from "stripe";
import type { PaymentProviderAdapter } from "@/lib/payments/provider";

// Stripe amounts are integer minor units (cents); every other `amount` in
// this app (payments.amount, applicants.fee_amount) is a plain major-unit
// decimal, matching how OfferForm/FeeTrackingForm already store fees. The
// x100/÷100 conversion is the boundary where that meets Stripe's API --
// kept entirely inside this file, never leaks out as a convention other
// code has to know about.
function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
function fromMinorUnits(amount: number): number {
  return amount / 100;
}

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set in .env.local yet. Get it from https://dashboard.stripe.com/apikeys.");
  }
  return new Stripe(key);
}

export const stripeAdapter: PaymentProviderAdapter = {
  name: "stripe",

  async createCheckoutSession(input) {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: toMinorUnits(input.amount),
            product_data: { name: input.description },
          },
          quantity: 1,
        },
      ],
      // Set on both the session and the resulting PaymentIntent -- webhook
      // events for later charges/refunds carry the PaymentIntent's
      // metadata, not the session's, so this needs to be on both to be
      // found reliably regardless of which event type arrives.
      metadata: { paymentId: input.paymentId },
      payment_intent_data: { metadata: { paymentId: input.paymentId } },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { checkoutUrl: session.url };
  },

  parseWebhookEvent(rawBody, signatureHeader) {
    const stripe = getStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set in .env.local yet. Get it from the Stripe dashboard's webhook endpoint settings.");
    }
    // Throws on an invalid/forged signature -- this is the entire trust
    // boundary for the webhook route, deliberately not caught here.
    const event = stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.metadata?.paymentId ?? null;
        if (!paymentId || session.amount_total == null) return null;
        return {
          type: "payment_succeeded",
          providerEventId: event.id,
          providerTransactionId: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
          amount: fromMinorUnits(session.amount_total),
          currency: (session.currency ?? "usd").toUpperCase(),
          paymentId,
        };
      }
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.metadata?.paymentId ?? null;
        if (!paymentId || session.amount_total == null) return null;
        return {
          type: "payment_failed",
          providerEventId: event.id,
          providerTransactionId: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
          amount: fromMinorUnits(session.amount_total),
          currency: (session.currency ?? "usd").toUpperCase(),
          paymentId,
        };
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentId = charge.metadata?.paymentId ?? null;
        if (!paymentId) return null;
        return {
          type: "refunded",
          providerEventId: event.id,
          providerTransactionId: typeof charge.payment_intent === "string" ? charge.payment_intent : charge.id,
          amount: fromMinorUnits(charge.amount_refunded),
          currency: charge.currency.toUpperCase(),
          paymentId,
        };
      }
      default:
        // Stripe sends many event types this app has no use for -- not an
        // error, just nothing to act on.
        return null;
    }
  },
};
