import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Delivery events from the mail provider. for-claude-code-email-inventory.md:
// "delivery is tracked via the provider's webhook (sent / delivered / opened /
// bounced), never assumed from a successful send."
//
// Without this the log says "sent" and stops -- which is what it did when an
// email to a non-existent domain was recorded as sent on 2026-08-16.

interface ResendEvent {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    bounce?: { message?: string; subType?: string };
    reason?: string;
  };
}

/** The provider's vocabulary mapped to ours. */
const EVENT_STATUS: Record<string, "delivered" | "opened" | "bounced"> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.bounced": "bounced",
  "email.complained": "bounced",
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const signature = request.headers.get("svix-signature") ?? request.headers.get("resend-signature");

  const raw = await request.text();

  // Refuse unsigned events when a secret is configured. Without a secret the
  // route stays open in development, but an unverified delivery event must
  // never be able to clear a bounce task in production -- that would let anyone
  // re-enable sending to a dead address.
  if (secret && !signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Unparseable payload." }, { status: 400 });
  }

  const status = event.type ? EVENT_STATUS[event.type] : undefined;
  const messageId = event.data?.email_id;
  if (!status || !messageId) {
    // Not an event we act on. 200 so the provider stops retrying.
    return NextResponse.json({ ok: true, ignored: event.type ?? "unknown" });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("applicant_emails")
    .select("id, center_id, applicant_id, to_email, status")
    .eq("provider_message_id", messageId)
    .maybeSingle();
  if (!row) return NextResponse.json({ ok: true, unmatched: true });

  // "Opened" never overwrites "bounced" -- an open on a message that later
  // bounced would otherwise look like success. Only ever move forward.
  const rank = { sent: 0, delivered: 1, opened: 2, bounced: 3, failed: 3 } as const;
  const current = (row.status ?? "sent") as keyof typeof rank;
  if (rank[status] < rank[current]) return NextResponse.json({ ok: true, stale: true });

  const now = new Date().toISOString();
  // "the provider's plain-language reason ('no such domain,' never a status
  // code)".
  const bounceReason =
    status === "bounced"
      ? (event.data?.bounce?.message ?? event.data?.reason ?? "The provider could not deliver it.")
      : null;

  await admin
    .from("applicant_emails")
    .update({
      status,
      delivered_at: status === "delivered" ? now : undefined,
      opened_at: status === "opened" ? now : undefined,
      bounced_at: status === "bounced" ? now : undefined,
      bounce_reason: bounceReason ?? undefined,
    })
    .eq("id", row.id);

  if (status === "bounced") {
    const { data: existing } = await admin
      .from("email_bounce_tasks")
      .select("id, consecutive_bounces, resolved_at")
      .eq("center_id", row.center_id)
      .eq("email_address", row.to_email)
      .maybeSingle();

    if (existing && !existing.resolved_at) {
      // Second strike. The send path reads this and stops.
      await admin
        .from("email_bounce_tasks")
        .update({ consecutive_bounces: existing.consecutive_bounces + 1, reason: bounceReason ?? undefined })
        .eq("id", existing.id);
    } else {
      await admin.from("email_bounce_tasks").upsert(
        {
          center_id: row.center_id,
          applicant_id: row.applicant_id,
          email_address: row.to_email,
          reason: bounceReason,
          consecutive_bounces: 1,
          resolved_at: null,
        },
        { onConflict: "center_id,email_address" }
      );
    }
  }

  if (status === "delivered") {
    // "Doesn't auto-clear; stays open until a later message to that address
    // delivers." This is that later message.
    await admin
      .from("email_bounce_tasks")
      .update({ resolved_at: now, consecutive_bounces: 0 })
      .eq("center_id", row.center_id)
      .eq("email_address", row.to_email)
      .is("resolved_at", null);
  }

  return NextResponse.json({ ok: true, status });
}
