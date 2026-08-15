"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SIGNUP_QUESTIONS } from "@/lib/fol/volunteer-signup-questions";

export interface VolunteerSignupState {
  error: string | null;
}

// Volunteers never get a real session -- the token itself, re-validated
// here server-side (not trusted from a hidden form field), is the only
// auth. The audio file is uploaded via the admin client from this same
// action rather than a direct browser->Storage upload, since there's no
// authenticated user to sign that upload as.
//
// Placeholder question wording (SIGNUP_QUESTIONS above) pending the real
// Volunteer Sign-Up.dc.html handover -- the underlying data shape
// (six {question, answer} pairs + one audio file) is what FOL's Day-10
// unlock actually depends on, not the exact wording, so this unblocks FOL
// now without waiting on that file.
export async function submitVolunteerSignupProfile(_prevState: VolunteerSignupState, formData: FormData): Promise<VolunteerSignupState> {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) return { error: "Something went wrong. Refresh and try again." };

  const admin = createAdminClient();
  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("course_id, volunteer_student_id, expires_at")
    .eq("token", token)
    .eq("role", "volunteer_student")
    .maybeSingle();
  if (!accessToken || !accessToken.volunteer_student_id || new Date(accessToken.expires_at) < new Date()) {
    return { error: "This link has expired or isn't valid." };
  }

  const [{ data: volunteer }, { data: course }] = await Promise.all([
    admin.from("volunteer_students").select("id, course_id").eq("id", accessToken.volunteer_student_id).maybeSingle(),
    admin.from("courses").select("center_id").eq("id", accessToken.course_id).maybeSingle(),
  ]);
  if (!volunteer || !course) return { error: "Something went wrong. Refresh and try again." };
  const centerId = course.center_id;

  const answers = SIGNUP_QUESTIONS.map((question, i) => ({
    question,
    answer: (formData.get(`answer_${i}`) as string | null)?.trim() || "",
  }));
  if (answers.some((a) => !a.answer)) return { error: "Please answer every question." };

  const audioFile = formData.get("audio");
  let audioUrl: string | null = null;
  if (audioFile instanceof File && audioFile.size > 0) {
    const storagePath = `${centerId}/${volunteer.id}-${Date.now()}.${audioFile.name.split(".").pop() ?? "webm"}`;
    const { error: uploadError } = await admin.storage.from("volunteer-signup-audio").upload(storagePath, audioFile, {
      contentType: audioFile.type || "audio/webm",
    });
    if (uploadError) return { error: "Could not upload the recording. Try again." };
    audioUrl = storagePath;
  }

  const { error: profileError } = await admin.from("volunteer_signup_profiles").insert({
    center_id: centerId,
    course_id: volunteer.course_id,
    volunteer_student_id: volunteer.id,
    written_answers: answers,
    audio_url: audioUrl,
  });
  if (profileError) return { error: "Could not save your answers. Try again." };

  await admin.from("volunteer_students").update({ signup_completed_at: new Date().toISOString() }).eq("id", volunteer.id);

  // No client-side navigation happens on a plain "use server" form action
  // without one of revalidatePath/redirect -- without this, the page kept
  // showing the just-submitted (and now stale) sign-up form until a manual
  // reload, even though the write itself had already succeeded. redirect()
  // to the same URL forces a fresh server render, which is what flips this
  // page over to the ongoing dashboard now that signup_completed_at is set.
  redirect(`/student/${token}`);
}
