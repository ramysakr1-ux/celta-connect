import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// for-claude-code-announcements.md's "Build blockers": push infra didn't
// exist at all. Web Push + VAPID, confirmed with Ramy 2026-08-19 --
// deliberately narrow, only ever three kinds during a course (cancellation,
// room change, something already late) plus the volunteer "starts in 30
// min" reminder. Never used for anything else; email covers everything
// before/after the course runs.
function getVapidDetails() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT are not set yet -- generate with `npx web-push generate-vapid-keys` and add all three to the environment."
    );
  }
  return { publicKey, privateKey, subject };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Sends one push to every subscription owned by the given profiles and/or
 * volunteer_students. A subscription that comes back expired (410 Gone) or
 * not found (404) is deleted immediately -- the browser revoked or
 * replaced it, so keeping the row around would just mean a silent failed
 * send next time instead of a clean one now.
 */
export async function sendPushToOwners(
  owners: { profileIds?: string[]; volunteerStudentIds?: string[] },
  payload: PushPayload
): Promise<{ sent: number; removed: number }> {
  const profileIds = owners.profileIds ?? [];
  const volunteerStudentIds = owners.volunteerStudentIds ?? [];
  if (profileIds.length === 0 && volunteerStudentIds.length === 0) return { sent: 0, removed: 0 };

  // Every call site so far (cancellation, individual-tutorial cancellation,
  // the volunteer 30-min reminder) runs AFTER its own real work already
  // committed -- a missing/broken VAPID setup shouldn't turn "the thing
  // happened" into an uncaught 500 for something that's purely a courtesy
  // notification. Caught here, once, instead of asking every caller to
  // remember to guard it.
  let vapid: { publicKey: string; privateKey: string; subject: string };
  try {
    vapid = getVapidDetails();
  } catch (err) {
    console.error("sendPushToOwners: VAPID not configured, skipping push", err);
    return { sent: 0, removed: 0 };
  }
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const admin = createAdminClient();
  const orFilter = [
    profileIds.length > 0 ? `profile_id.in.(${profileIds.join(",")})` : null,
    volunteerStudentIds.length > 0 ? `volunteer_student_id.in.(${volunteerStudentIds.join(",")})` : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data: subscriptions } = await admin.from("push_subscriptions").select("*").or(orFilter);

  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);

  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        body
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
        removed += 1;
      }
      // Any other error (network blip, provider hiccup) is left alone --
      // the subscription might still be good next time.
    }
  }

  return { sent, removed };
}
