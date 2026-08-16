"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";

// Named invitations, and the tutor role that travels with them.
//
// "A role is invited, never self-selected, and nothing in Connect promotes an
// account on its own" (the getting-started letter). The shared join links stay
// for letting a cohort in; this is the path where the centre decides who is
// what before they arrive.

export interface InviteState {
  error: string | null;
  sent?: string | null;
}

const TUTOR_ROLES = [
  "main_course_tutor",
  "assistant_course_tutor",
  "teaching_practice_tutor",
  "input_session_tutor",
  "external_assessor",
] as const;
type TutorRole = (typeof TUTOR_ROLES)[number];

export async function inviteToCourse(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const profile = await requireRole("admin");

  const courseId = formData.get("course_id");
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const fullName = (formData.get("full_name") as string | null)?.trim() || null;
  const role = formData.get("role");
  const tutorRoleRaw = (formData.get("tutor_role") as string | null) || null;

  if (typeof courseId !== "string" || !email) return { error: "Who are you inviting?" };
  if (role !== "trainee" && role !== "trainer") return { error: "Choose whether they're a candidate or a tutor." };
  if (tutorRoleRaw && !TUTOR_ROLES.includes(tutorRoleRaw as TutorRole)) return { error: "Unknown tutor role." };
  // A candidate has no tutor role; carrying one would be meaningless data that
  // later reads as a mistake.
  const tutorRole = role === "trainer" ? ((tutorRoleRaw || null) as TutorRole | null) : null;

  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("id, center_id, name").eq("id", courseId).maybeSingle();
  if (!course || course.center_id !== profile.center_id) return { error: "Course not found." };

  // Only one main course tutor at a time. The database enforces this on
  // course_tutors; catching it here means the person inviting is told who
  // currently holds it rather than seeing a constraint error.
  if (tutorRole === "main_course_tutor") {
    const { data: existing } = await admin
      .from("course_tutors")
      .select("profile_id")
      .eq("course_id", courseId)
      .eq("tutor_role", "main_course_tutor")
      .is("left_at", null)
      .maybeSingle();
    if (existing) {
      const { data: who } = await admin.from("profiles").select("full_name").eq("id", existing.profile_id).maybeSingle();
      return {
        error: `${who?.full_name ?? "Someone"} is already the main course tutor. Change their role first, then invite the new one.`,
      };
    }
  }

  // Re-inviting the same address updates the invitation rather than creating a
  // second — the unique constraint is (course_id, email), and a person invited
  // twice is one person.
  const { data: invitation, error } = await admin
    .from("course_invitations")
    .upsert(
      {
        course_id: courseId,
        center_id: course.center_id,
        email,
        full_name: fullName,
        role,
        tutor_role: tutorRole,
        invited_by: profile.id,
        invited_at: new Date().toISOString(),
        revoked_at: null,
      },
      { onConflict: "course_id,email" }
    )
    .select("token")
    .single();

  if (error || !invitation) return { error: `Could not create the invitation: ${error?.message ?? "unknown"}` };

  const { data: centre } = await admin
    .from("centers")
    .select("name, admissions_email")
    .eq("id", course.center_id)
    .maybeSingle();

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "https://celtaconnect.com";
  const inviteUrl = `${base}/join/${invitation.token}`;

  // Tutors get the invitation email from Invitations.dc.html. Candidates are
  // invited through the admissions flow, which has its own emails and its own
  // green light -- sending them a bare join link here would bypass it.
  if (role === "trainer") {
    const { sendApplicantEmail, tutorAddedEmailHtml } = await import("@/lib/admissions-email");
    const readableRole = (tutorRole ?? "course tutor").replace(/_/g, " ");
    const { error: sendError } = await sendApplicantEmail({
      centerName: centre?.name ?? "Your centre",
      centerAdmissionsEmail: centre?.admissions_email ?? null,
      to: email,
      subject: "you have been added as a course tutor",
      centerId: course.center_id,
      type: "tutor_added",
      sentBy: profile.id,
      recipientName: fullName,
      html: tutorAddedEmailHtml({
        tutorFirstName: (fullName ?? email).split(" ")[0],
        addedByName: profile.full_name,
        addedByRole: "course administrator",
        courseName: course.name,
        courseFact: course.name,
        roleFact: readableRole,
        centreName: centre?.name ?? "the centre",
        inviteUrl,
      }),
    });
    if (sendError) {
      // The invitation exists either way -- it is a real record, and the link
      // can still be copied by hand. Saying so beats pretending it failed.
      return { error: `Invitation created, but the email didn't send: ${sendError}`, sent: null };
    }
  }

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  return { error: null, sent: email };
}

/** Withdraw an invitation that hasn't been taken up. */
export async function revokeInvitation(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const profile = await requireRole("admin");
  const id = formData.get("invitation_id");
  const courseId = formData.get("course_id");
  if (typeof id !== "string" || typeof courseId !== "string") return { error: "Something went wrong." };

  const admin = createAdminClient();
  // Revoked, never deleted: who was invited and never came is worth seeing.
  const { error } = await admin
    .from("course_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .is("accepted_at", null);
  if (error) return { error: "Could not withdraw the invitation." };

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  return { error: null };
}

/**
 * Change a tutor's role on a course, including moving the MCT.
 *
 * Ramy, 2026-08-16: "There's a possibility that the MCT can no longer work,
 * and then the ACT becomes the MCT. So there should be an option in the course
 * admin page to reverse it or choose another MCT."
 *
 * Moving the MCT is two writes, and they must both happen: the outgoing MCT is
 * stepped down first, then the incoming one promoted. Doing it the other way
 * round trips the one-MCT constraint, and leaving the first half undone would
 * leave a course with none -- which silently re-opens course-wide announcements
 * to every tutor, because that check fails open.
 */
export async function changeTutorRole(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const profile = await requireRole("admin");
  const courseTutorId = formData.get("course_tutor_id");
  const courseId = formData.get("course_id");
  const nextRoleRaw = (formData.get("tutor_role") as string | null) || null;

  if (typeof courseTutorId !== "string" || typeof courseId !== "string") return { error: "Something went wrong." };
  if (nextRoleRaw && !TUTOR_ROLES.includes(nextRoleRaw as TutorRole)) return { error: "Unknown tutor role." };
  const nextRole = (nextRoleRaw || null) as TutorRole | null;

  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("id, center_id").eq("id", courseId).maybeSingle();
  if (!course || course.center_id !== profile.center_id) return { error: "Course not found." };

  if (nextRole === "main_course_tutor") {
    // Step the current MCT down to assistant course tutor rather than to
    // nothing: they are still a tutor on the course, and blanking the field
    // would lose that.
    const { error: demoteError } = await admin
      .from("course_tutors")
      .update({ tutor_role: "assistant_course_tutor" })
      .eq("course_id", courseId)
      .eq("tutor_role", "main_course_tutor")
      .is("left_at", null)
      .neq("id", courseTutorId);
    if (demoteError) return { error: "Could not move the main course tutor role. Nothing was changed." };
  }

  const { error } = await admin
    .from("course_tutors")
    .update({ tutor_role: nextRole })
    .eq("id", courseTutorId)
    .eq("course_id", courseId);
  if (error) return { error: "Could not change the role. Try again." };

  revalidatePath(`/dashboard/admin/courses/${courseId}`);
  return { error: null };
}
