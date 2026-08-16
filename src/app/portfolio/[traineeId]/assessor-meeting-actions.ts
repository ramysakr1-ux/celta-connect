"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";

// Handbook 14.2's candidate-concerns meeting -- the candidate's side of it.
//
// Deliberately the thinnest possible action: ask, or withdraw the ask. No note
// field, because anything typed here would be stored in a database read by
// people the candidate did not choose to tell. What they want to say is for
// the meeting.
//
// Session-scoped client on purpose, not the admin client. RLS on
// assessor_meeting_requests grants a candidate rights over their own row and
// grants tutors nothing at all -- routing this through the admin client would
// quietly step around the one protection that makes the channel trustworthy.

export interface AssessorMeetingState {
  error: string | null;
}

export async function requestAssessorMeeting(
  _prev: AssessorMeetingState,
  formData: FormData
): Promise<AssessorMeetingState> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) return { error: "Sign in first." };

  const traineeId = formData.get("trainee_id");
  const withdraw = formData.get("withdraw") === "1";

  // Only ever your own request -- a tutor viewing a candidate's portfolio must
  // not be able to raise or cancel one on their behalf.
  if (typeof traineeId !== "string" || traineeId !== profile.id) {
    return { error: "You can only do this for yourself." };
  }
  if (!profile.course_id) return { error: "You're not on a course." };

  const supabase = await createClient();

  if (withdraw) {
    const { error } = await supabase
      .from("assessor_meeting_requests")
      .update({ withdrawn_at: new Date().toISOString() })
      .eq("course_id", profile.course_id)
      .eq("trainee_id", profile.id);
    if (error) return { error: "Could not withdraw the request. Try again." };
  } else {
    // upsert, because the unique constraint is (course_id, trainee_id): asking
    // again after withdrawing should revive the row, not fail.
    const { error } = await supabase.from("assessor_meeting_requests").upsert(
      {
        course_id: profile.course_id,
        trainee_id: profile.id,
        requested_at: new Date().toISOString(),
        withdrawn_at: null,
      },
      { onConflict: "course_id,trainee_id" }
    );
    if (error) return { error: "Could not send the request. Try again." };
  }

  revalidatePath(`/portfolio/${profile.id}`);
  return { error: null };
}
