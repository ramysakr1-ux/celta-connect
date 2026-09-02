"use server";

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface UnsubscribeState {
  error: string | null;
  done?: boolean;
  optedOut?: boolean;
}

// Ramy, 25 Aug 2026: "if they don't wanna be notified in the email, they
// can just disable it in the email itself" -- same token-is-the-only-proof
// model as declineClass (decline-actions.ts), no session on this path
// either. Covers both class-reminder emails (day-before and 30-minute);
// push keeps its own separate browser toggle, untouched by this.
//
// Ramy, 25 Aug 2026: "if they change their mind later, they can always come
// back to the page and enable notifications" -- one action, both
// directions, so the unsubscribe page (and the Footer link into it) can
// always show the right button for whichever state the volunteer is
// currently in.
async function setRemindersOptedOut(token: string, optedOut: boolean): Promise<UnsubscribeState> {
  const admin = createAdminClient();
  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("volunteer_student_id, expires_at")
    .eq("token", token)
    .eq("role", "volunteer_student")
    .maybeSingle();
  if (!accessToken?.volunteer_student_id || new Date(accessToken.expires_at) < new Date()) {
    return { error: "This link has expired." };
  }

  const { error } = await admin.from("volunteer_students").update({ reminders_opted_out: optedOut }).eq("id", accessToken.volunteer_student_id);
  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[student/[token]/unsubscribe-actions.ts:action]", error);
    return { error: "Could not save. Try again." };
  }

  return { error: null, done: true, optedOut };
}

export async function unsubscribeReminders(_prevState: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) return { error: "Something went wrong. Refresh and try again." };
  return setRemindersOptedOut(token, true);
}

export async function resubscribeReminders(_prevState: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) return { error: "Something went wrong. Refresh and try again." };
  return setRemindersOptedOut(token, false);
}
