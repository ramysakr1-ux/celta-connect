import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActivePaymentProvider } from "@/lib/payments/provider";

// Stripe (or whichever provider is active) posts here on every payment
// event. No user session exists -- the signature check IS the auth, same
// role the CRON_SECRET bearer header plays for the cron routes. Must read
// the RAW body (not request.json()) since signature verification hashes
// the exact bytes Stripe sent; parsing first would invalidate it.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  // No centre id here on purpose: this route IS the Stripe endpoint, so the
  // adapter that must parse the payload is Stripe's regardless of which
  // provider any given centre has since connected -- an event already in
  // flight still has to be understood. A second provider gets its own route.
  const provider = await getActivePaymentProvider();
  let event;
  try {
    event = provider.parseWebhookEvent(rawBody, signature);
  } catch (err) {
    // Invalid/forged signature -- the one case this route must reject.
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid signature." }, { status: 400 });
  }

  // A real event, just not one this app acts on (Stripe sends many types),
  // or one whose checkout session was created outside this app's flow (no
  // paymentId metadata) -- nothing to reconcile either way.
  if (!event || !event.paymentId) return NextResponse.json({ received: true });

  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("id, center_id").eq("id", event.paymentId).maybeSingle();
  if (!payment) return NextResponse.json({ received: true });

  // Idempotency: a provider can and will redeliver the same event. The
  // unique(provider, provider_event_id) constraint makes a duplicate
  // insert fail cleanly instead of double-processing.
  const { error: logError } = await admin.from("payment_provider_transactions").insert({
    center_id: payment.center_id,
    provider: provider.name,
    provider_event_id: event.providerEventId,
    payment_id: payment.id,
    event_type: event.type,
    amount: event.amount,
    currency: event.currency,
    raw_payload: JSON.parse(rawBody),
  });
  if (logError) {
    // Unique violation = already processed this exact event; anything
    // else is a real problem worth surfacing to Stripe as a retry signal.
    if (logError.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: "Could not log the event." }, { status: 500 });
  }

  if (event.type === "payment_succeeded") {
    await admin
      .from("payments")
      .update({
        status: "paid",
        source: "provider",
        provider: provider.name,
        provider_transaction_id: event.providerTransactionId,
        paid_at: new Date().toISOString(),
      })
      .eq("id", payment.id);
  } else if (event.type === "refunded") {
    await admin.from("payments").update({ status: "refunded" }).eq("id", payment.id);
  }
  // "payment_failed" (e.g. an async payment method failing) is logged to
  // payment_provider_transactions above but doesn't change status --
  // the instalment stays pending and the applicant can retry the same
  // checkout link. "Missed" is due-date-driven (the cron), not event-driven.

  return NextResponse.json({ received: true });
}
