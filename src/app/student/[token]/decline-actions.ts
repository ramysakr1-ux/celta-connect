"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DeclineState {
  error: string | null;
  declined?: boolean;
}

// Volunteer View.dc.html: "a one-tap decline, not an email, because
// attendance changes the lesson." No session on this path at all (same as
// every other volunteer write) -- the token itself is the only proof of
// identity, re-validated here rather than trusted from the client.
export async function declineClass(_prevState: DeclineState, formData: FormData): Promise<DeclineState> {
  const token = formData.get("token");
  const eventId = formData.get("event_id");
  if (typeof token !== "string" || typeof eventId !== "string" || !token || !eventId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

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

  const { error } = await admin
    .from("volunteer_declines")
    .upsert({ volunteer_student_id: accessToken.volunteer_student_id, timetable_event_id: eventId }, { onConflict: "volunteer_student_id,timetable_event_id" });
  if (error) return { error: "Could not save. Try again." };

  revalidatePath(`/student/${token}`);
  return { error: null, declined: true };
}

// The other half of the one-tap decline, which did not exist.
//
// Ramy clicked "Let them know" on the demo, 30 Aug 2026, and the panel
// settled permanently into "You've let them know you can't make it." --
// a dead end with no control on it. A volunteer whose plans change back
// had no way to say so, and the centre staffs teaching practice around
// how many volunteers it expects: an unwithdrawable decline turns into a
// class planned for fewer students than actually turn up.
//
// Same token proof as the decline itself, and a delete rather than a
// status flag, so the absence of a row keeps meaning "coming".
export async function undoDeclineClass(_prevState: DeclineState, formData: FormData): Promise<DeclineState> {
  const token = formData.get("token");
  const eventId = formData.get("event_id");
  if (typeof token !== "string" || typeof eventId !== "string" || !token || !eventId) {
    return { error: "Something went wrong. Refresh and try again." };
  }

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

  const { error } = await admin
    .from("volunteer_declines")
    .delete()
    .eq("volunteer_student_id", accessToken.volunteer_student_id)
    .eq("timetable_event_id", eventId);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath(`/student/${token}`);
  return { error: null, declined: false };
}
