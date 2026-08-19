import "server-only";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Server-only client for sending join-link emails from celtaconnect.com.
// Never import this outside a server action, and never expose
// RESEND_API_KEY to the browser.
export function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set in .env.local yet. Get it from https://resend.com/api-keys."
    );
  }

  return new Resend(apiKey);
}

// Ramy, 2026-08-15: nobody should notice "Connect" as a brand -- the
// sender name a recipient actually recognises is their own centre's name,
// not the platform underneath it. Was a hardcoded "Connect <...>" constant;
// now every call site passes the centre name it already has (or already
// looked up) in scope. Falls back to "Connect" only when no centre is
// resolvable at all (e.g. a sign-in link for an email with no account).
export function joinLinkSender(centerName: string | null | undefined): string {
  return `${centerName || "Connect"} <invites@celtaconnect.com>`;
}

// For flows that only have a user id at send time (sign-in link, password
// reset) -- every profile carries a required center_id, so one join gets
// the centre name to pass into joinLinkSender above.
export async function centerNameForUserId(admin: SupabaseClient<Database>, userId: string): Promise<string | null> {
  const { data: profile } = await admin.from("profiles").select("center_id").eq("id", userId).maybeSingle();
  if (!profile) return null;
  const { data: center } = await admin.from("centers").select("name").eq("id", profile.center_id).maybeSingle();
  return center?.name ?? null;
}

// Same lookup as centerNameForUserId, but also returns the id -- needed by
// sendApplicantEmail's centerId param so sign-in-link/password-reset sends
// can be tracked (for-claude-code-email-delivery-tracking.md) the same way
// every other email already is.
export async function centerInfoForUserId(
  admin: SupabaseClient<Database>,
  userId: string
): Promise<{ id: string; name: string | null } | null> {
  const { data: profile } = await admin.from("profiles").select("center_id").eq("id", userId).maybeSingle();
  if (!profile) return null;
  const { data: center } = await admin.from("centers").select("name").eq("id", profile.center_id).maybeSingle();
  return { id: profile.center_id, name: center?.name ?? null };
}
