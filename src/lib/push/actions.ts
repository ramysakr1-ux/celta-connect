"use server";

import "server-only";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PushActionState {
  error: string | null;
  subscribed: boolean;
}

interface SubscriptionInput {
  endpoint: string;
  p256dh: string;
  authKey: string;
}

// Any authenticated profile -- trainee, trainer, admin -- has a real
// Supabase Auth session, so profile_id comes from the session rather than
// trusting anything the client sends.
export async function subscribeSessionPush(input: SubscriptionInput): Promise<PushActionState> {
  const session = await getCurrentProfile();
  if (!session?.profile) return { error: "Not signed in.", subscribed: false };

  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .upsert(
      { profile_id: session.profile.id, endpoint: input.endpoint, p256dh: input.p256dh, auth_key: input.authKey },
      { onConflict: "endpoint" }
    );
  if (error) return { error: "Could not save. Try again.", subscribed: false };
  return { error: null, subscribed: true };
}

export async function unsubscribeSessionPush(endpoint: string): Promise<PushActionState> {
  const session = await getCurrentProfile();
  if (!session?.profile) return { error: "Not signed in.", subscribed: true };

  const admin = createAdminClient();
  await admin.from("push_subscriptions").delete().eq("profile_id", session.profile.id).eq("endpoint", endpoint);
  return { error: null, subscribed: false };
}

// Volunteer: no session at all (migration 0030 -- "never get a real
// Supabase Auth account"). The token itself is the only proof of identity
// available, same as every other volunteer action on /student/[token].
export async function subscribeVolunteerPush(token: string, input: SubscriptionInput): Promise<PushActionState> {
  const admin = createAdminClient();
  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("volunteer_student_id, expires_at")
    .eq("token", token)
    .eq("role", "volunteer_student")
    .maybeSingle();

  if (!accessToken?.volunteer_student_id || new Date(accessToken.expires_at) < new Date()) {
    return { error: "That link is invalid or has expired.", subscribed: false };
  }

  const { error } = await admin
    .from("push_subscriptions")
    .upsert(
      {
        volunteer_student_id: accessToken.volunteer_student_id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth_key: input.authKey,
      },
      { onConflict: "endpoint" }
    );
  if (error) return { error: "Could not save. Try again.", subscribed: false };
  return { error: null, subscribed: true };
}

export async function unsubscribeVolunteerPush(token: string, endpoint: string): Promise<PushActionState> {
  const admin = createAdminClient();
  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("volunteer_student_id")
    .eq("token", token)
    .eq("role", "volunteer_student")
    .maybeSingle();
  if (!accessToken?.volunteer_student_id) return { error: null, subscribed: false };

  await admin
    .from("push_subscriptions")
    .delete()
    .eq("volunteer_student_id", accessToken.volunteer_student_id)
    .eq("endpoint", endpoint);
  return { error: null, subscribed: false };
}
