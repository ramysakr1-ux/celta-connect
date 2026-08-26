"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkVolunteerPeople, unlinkVolunteer } from "@/lib/volunteer-identity";
import { canView } from "@/lib/auth/centre-permissions";

export async function linkVolunteerAction(formData: FormData): Promise<void> {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  if (!can(ctx.roles, "centre.settings.edit", ctx.overrides)) return;

  const volunteerStudentIdA = formData.get("volunteer_student_id_a");
  const volunteerStudentIdB = formData.get("volunteer_student_id_b");
  if (typeof volunteerStudentIdA !== "string" || typeof volunteerStudentIdB !== "string") return;

  const admin = createAdminClient();
  // Derived server-side, never trusted from the client -- both volunteers
  // must actually belong to a centre this admin holds a role at.
  const { data: rows } = await admin
    .from("volunteer_students")
    .select("id, course_id")
    .in("id", [volunteerStudentIdA, volunteerStudentIdB]);
  const courseIdsInvolved = [...new Set((rows ?? []).map((r) => r.course_id))];
  const { data: coursesInvolved } = await admin.from("courses").select("id, center_id").in("id", courseIdsInvolved);
  const centerIds = new Set((coursesInvolved ?? []).map((c) => c.center_id));
  if (centerIds.size !== 1) return;
  const [centerId] = centerIds;
  if (!centerId || !ctx.availableCenterIds.includes(centerId)) return;

  await linkVolunteerPeople(admin, { centerId, volunteerStudentIdA, volunteerStudentIdB });

  revalidatePath("/centre");
}

export async function unlinkVolunteerAction(formData: FormData): Promise<void> {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  if (!can(ctx.roles, "centre.settings.edit", ctx.overrides)) return;

  const volunteerStudentId = formData.get("volunteer_student_id");
  if (typeof volunteerStudentId !== "string") return;

  const admin = createAdminClient();
  const { data: row } = await admin.from("volunteer_students").select("course_id").eq("id", volunteerStudentId).maybeSingle();
  if (!row) return;
  const { data: course } = await admin.from("courses").select("center_id").eq("id", row.course_id).maybeSingle();
  if (!course || !ctx.availableCenterIds.includes(course.center_id)) return;

  await unlinkVolunteer(admin, volunteerStudentId);

  revalidatePath("/centre");
}

// Ramy, 27 Aug 2026: "a different color light until someone clicks on it" --
// clears the ambient change-indicator on the Centre Management admissions
// card. Shared, not per-viewer, same as this-week/page.tsx's existing
// no_interview_slots read_at usage -- whoever clicks it clears it for
// everyone, matching a team inbox rather than individual unread state.
export async function markAdmissionsNotificationsRead(centerId: string): Promise<void> {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  if (!canView(ctx.roles, "admissions.view", ctx.overrides)) return;
  if (!ctx.availableCenterIds.includes(centerId)) return;

  const admin = createAdminClient();
  await admin
    .from("admissions_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("center_id", centerId)
    .is("read_at", null);

  revalidatePath("/centre");
}
