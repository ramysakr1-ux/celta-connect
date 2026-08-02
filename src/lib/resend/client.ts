import "server-only";
import { Resend } from "resend";

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

export const JOIN_LINK_SENDER = "Celta Connect <invites@celtaconnect.com>";
