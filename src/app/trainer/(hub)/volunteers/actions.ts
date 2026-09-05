"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { sendVolunteerClassStartingEmail } from "@/lib/volunteer-class-starting";
import { linkVolunteerByEmail } from "@/lib/volunteer-identity";

export interface FormState {
  error: string | null;
}

// Tokenized, course-scoped, auto-expiring link -- no password, the same
// mechanism the architecture plan reserves for assessor links too (see
// migration 0030). Expiry is the course end date, matching "expire at
// course close" from the auth-model spec.
export async function addVolunteerStudent(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { error: "Name is required." };
  const level = (formData.get("level") as string | null)?.trim() || null;
  // v2 (design_handoff_volunteer_students_v2 §7): email is what links a new
  // registration to hours already on file -- exact-match auto-link via the
  // pool's own rule (linkVolunteerByEmail), never by name.
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() || null;

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("end_date").eq("id", trainer.course_id).maybeSingle();
  if (!course) return { error: "Could not find your course." };

  const { data: volunteer, error } = await supabase
    .from("volunteer_students")
    .insert({ course_id: trainer.course_id, name, level, email })
    .select("id")
    .single();

  if (error || !volunteer) return { error: "Could not add the student. Try again." };

  if (email && trainer.center_id) {
    await linkVolunteerByEmail(createAdminClient(), { volunteerStudentId: volunteer.id, centerId: trainer.center_id, email });
  }

  const expiresAt = new Date(`${course.end_date}T23:59:59Z`).toISOString();
  const { error: tokenError } = await supabase.from("course_access_tokens").insert({
    course_id: trainer.course_id,
    role: "volunteer_student",
    volunteer_student_id: volunteer.id,
    expires_at: expiresAt,
  });

  if (tokenError) {
    // The message above is what the person reads; this is what we read.
    console.error("[trainer/(hub)/volunteers:addVolunteerStudent]", tokenError);
    return { error: "Added the student, but could not create their link. Try again." };
  }

  // v2's button is "Add and send link" -- when an email was given, the
  // starting email with their link goes out immediately.
  if (email) {
    await sendVolunteerClassStartingEmail(createAdminClient(), { id: volunteer.id, name, email, level, course_id: trainer.course_id }, { skipIfAlreadySent: false });
  }

  revalidatePath("/trainer/volunteers");
  return { error: null };
}

export interface ReissueState {
  error: string | null;
  done: boolean;
}

// v2 student card: "Re-issue mints a new token, the old one dies,
// attendance and hours untouched" -- for the link that never arrived.
export async function reissueVolunteerLink(_prevState: ReissueState, formData: FormData): Promise<ReissueState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const volunteerId = formData.get("volunteer_id");
  if (typeof volunteerId !== "string" || !trainer.course_id) return { error: "Something went wrong.", done: false };

  const admin = createAdminClient();
  const { data: volunteer } = await admin
    .from("volunteer_students")
    .select("id, course_id")
    .eq("id", volunteerId)
    .eq("course_id", trainer.course_id)
    .maybeSingle();
  if (!volunteer) return { error: "Volunteer not found.", done: false };

  const { data: course } = await admin.from("courses").select("end_date").eq("id", trainer.course_id).maybeSingle();
  if (!course) return { error: "Could not find your course.", done: false };

  await admin.from("course_access_tokens").delete().eq("role", "volunteer_student").eq("volunteer_student_id", volunteer.id);
  const { error } = await admin.from("course_access_tokens").insert({
    course_id: trainer.course_id,
    role: "volunteer_student",
    volunteer_student_id: volunteer.id,
    expires_at: new Date(`${course.end_date}T23:59:59Z`).toISOString(),
  });
  if (error) {
    console.error("[trainer/(hub)/volunteers:reissueVolunteerLink]", error);
    return { error: "Could not create the new link. Try again.", done: false };
  }

  revalidatePath("/trainer/volunteers");
  return { error: null, done: true };
}

export interface ShareClassState {
  error: string | null;
  sentCount: number | null;
}

// v2 class header's "+ Share with class": the starting email with each
// student's own link, scoped to one class instead of the whole course.
export async function sendClassStartingEmails(_prevState: ShareClassState, formData: FormData): Promise<ShareClassState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const levelRaw = formData.get("level");
  if (!trainer.course_id) return { error: "No course assigned.", sentCount: null };
  const level = typeof levelRaw === "string" && levelRaw ? levelRaw : null;

  const admin = createAdminClient();
  let query = admin
    .from("volunteer_students")
    .select("id, name, email, level, course_id")
    .eq("course_id", trainer.course_id)
    .is("removed_at", null)
    .not("email", "is", null);
  query = level ? query.eq("level", level) : query.is("level", null);
  const { data: volunteers } = await query;

  let sentCount = 0;
  for (const volunteer of volunteers ?? []) {
    const result = await sendVolunteerClassStartingEmail(admin, volunteer, { skipIfAlreadySent: false });
    if (result.sent) sentCount += 1;
  }
  return { error: null, sentCount };
}

// A single read-only, no-login link for center business/admissions staff --
// people with no app account at all who aren't allowed on the course itself
// (distinct from the app's own "admin" role). Reuses whatever unexpired
// register_viewer token already exists for the course rather than minting a
// new one every time, so the shared link doesn't keep changing.
export async function getOrCreateRegisterViewToken(): Promise<{ token: string | null; error: string | null }> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { token: null, error: "No course assigned." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("course_access_tokens")
    .select("token")
    .eq("course_id", trainer.course_id)
    .eq("role", "register_viewer")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (existing) return { token: existing.token, error: null };

  const { data: course } = await supabase.from("courses").select("end_date").eq("id", trainer.course_id).maybeSingle();
  if (!course) return { token: null, error: "Could not find your course." };

  const expiresAt = new Date(`${course.end_date}T23:59:59Z`).toISOString();
  const { data: created, error } = await supabase
    .from("course_access_tokens")
    .insert({ course_id: trainer.course_id, role: "register_viewer", expires_at: expiresAt })
    .select("token")
    .single();

  // The real reason, not "try again": on the shared demo course the
  // database refuses every write and says so, and a tutor should read that.
  if (error || !created) return { token: null, error: error?.message ?? "Could not create the link." };
  return { token: created.token, error: null };
}

// Manual fallback until real speech-to-text is wired in (Claude's Messages
// API has no audio content-block type, and no transcription service is
// configured in this app -- see [[project_fol_pooled_evidence]]). A tutor
// listens to the recording and pastes a transcript here, which unlocks
// exactly the same way an automated one would (FOL's Day-10 gate doesn't
// care how transcript got populated).
export async function saveVolunteerTranscript(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const volunteerId = formData.get("volunteer_id");
  const transcript = (formData.get("transcript") as string | null)?.trim();
  if (typeof volunteerId !== "string" || !transcript || !trainer.course_id) return;

  const supabase = await createClient();
  await supabase
    .from("volunteer_signup_profiles")
    .update({ transcript, transcript_generated_at: new Date().toISOString() })
    .eq("volunteer_student_id", volunteerId)
    .eq("course_id", trainer.course_id);

  revalidatePath("/trainer/volunteers");
}

export interface SendStartingEmailState {
  error: string | null;
  sent: boolean;
}

// Ramy, 2026-08-19: the volunteer's join link is only ever copyable
// (CopyLinkButton) -- nothing ever emails it to them, and
// "volunteer_signed_up" is just a holding acknowledgement sent at signup,
// not the actual link. This is the manual send, alongside the automatic
// one (volunteer-class-starting-cron.ts, ~7 days before the course starts)
// for when a trainer wants it sent on their own timing instead.
export async function sendVolunteerStartingEmailNow(
  _prevState: SendStartingEmailState,
  formData: FormData
): Promise<SendStartingEmailState> {
  const trainer = await requireRole(["trainer", "admin"]);
  const volunteerId = formData.get("volunteer_id");
  if (typeof volunteerId !== "string" || !trainer.course_id) return { error: "Something went wrong.", sent: false };

  const admin = createAdminClient();
  const { data: volunteer } = await admin
    .from("volunteer_students")
    .select("id, name, email, level, course_id")
    .eq("id", volunteerId)
    .eq("course_id", trainer.course_id)
    .maybeSingle();
  if (!volunteer) return { error: "Volunteer not found.", sent: false };

  // A deliberate manual send is allowed to resend even if the automatic
  // cron already went out -- skipIfAlreadySent is only the automatic
  // sweep's own protection against sending itself twice.
  const result = await sendVolunteerClassStartingEmail(admin, volunteer, { skipIfAlreadySent: false });
  return result.sent ? { error: null, sent: true } : { error: result.reason ?? "Could not send the email.", sent: false };
}

export interface SendAllLinksState {
  error: string | null;
  sentCount: number | null;
}

// Volunteers.dc.html's "Send links" header action -- the bulk form of
// sendVolunteerStartingEmailNow above, same deliberate-manual-resend
// behaviour (skipIfAlreadySent: false), just for everyone with an email on
// file at once instead of one at a time down the list.
export async function sendAllVolunteerStartingEmails(
  _prevState: SendAllLinksState,
  _formData: FormData
): Promise<SendAllLinksState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned.", sentCount: null };

  const admin = createAdminClient();
  const { data: volunteers } = await admin
    .from("volunteer_students")
    .select("id, name, email, level, course_id")
    .eq("course_id", trainer.course_id)
    .not("email", "is", null);

  let sentCount = 0;
  for (const volunteer of volunteers ?? []) {
    const result = await sendVolunteerClassStartingEmail(admin, volunteer, { skipIfAlreadySent: false });
    if (result.sent) sentCount += 1;
  }

  return { error: null, sentCount };
}

export async function removeVolunteerStudent(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const volunteerId = formData.get("volunteer_id");
  if (typeof volunteerId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("volunteer_students")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", volunteerId)
    .eq("course_id", trainer.course_id ?? "");

  revalidatePath("/trainer/volunteers");
}
