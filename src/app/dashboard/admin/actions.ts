"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import type { DeliveryMode } from "@/lib/delivery-mode";

export interface FormState {
  error: string | null;
}

const VALID_DELIVERY_MODES: DeliveryMode[] = ["f2f", "online", "mixed"];

export async function createCourse(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireRole("admin");

  const name = formData.get("name");
  const startDate = formData.get("start_date");
  const endDate = formData.get("end_date");
  const deliveryMode = formData.get("delivery_mode");
  // Course Admin.dc.html step 1. The course code is the Cambridge course
  // number; cohort size is "Maximum cohort size".
  const courseCode = (formData.get("course_code") as string | null)?.trim() || null;
  const cohortRaw = (formData.get("cohort_size") as string | null) || null;
  // Steps 3-5 (for-claude-code-course-admin-final-scope.md). All optional at
  // creation: the design's sidebar says what can be deferred, and only step
  // 5's launch gates invites. Pricing (fee/deposit/currency) is deliberately
  // NOT collected here any more -- cut from the wizard per that spec
  // ("a centre-level concern"); those columns are now set from Centre
  // Admin's own per-course view instead (src/app/centre/courses/[id]/).
  const inputStart = (formData.get("input_start_time") as string | null)?.trim() || null;
  const tpStart = (formData.get("tp_start_time") as string | null)?.trim() || null;
  const daysOff = (formData.getAll("days_off") as string[]).filter(Boolean);
  const launch = formData.get("launch") === "1";
  // Step 4's tutor. Optional -- "Skip, I'll assign a tutor later" is a real
  // path -- but when given, the invitation is created and emailed at launch.
  const inviteEmail = (formData.get("invite_email") as string | null)?.trim().toLowerCase() || null;
  const inviteRole = (formData.get("invite_tutor_role") as string | null) || null;
  // Optional assessor, named now or left for the MCT to set later
  // (for-claude-code-course-admin-refinements.md).
  const assessorName = (formData.get("assessor_name") as string | null)?.trim() || null;
  const assessorEmail = (formData.get("assessor_email") as string | null)?.trim().toLowerCase() || null;

  if (
    typeof name !== "string" ||
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    !name ||
    !startDate ||
    !endDate
  ) {
    return { error: "Fill in a name, start date, and end date." };
  }

  if (endDate < startDate) {
    return { error: "End date must be on or after the start date." };
  }

  if (typeof deliveryMode !== "string" || !VALID_DELIVERY_MODES.includes(deliveryMode as DeliveryMode)) {
    return { error: "Choose how teaching practice is delivered." };
  }

  const cohortSize = cohortRaw ? Number(cohortRaw) : null;
  if (cohortSize !== null && (!Number.isInteger(cohortSize) || cohortSize <= 0)) {
    return { error: "Maximum cohort size should be a whole number." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("courses").insert({
    center_id: admin.center_id,
    name,
    course_code: courseCode,
    cohort_size: cohortSize,
    input_start_time: inputStart,
    tp_start_time: tpStart,
    days_off: daysOff.length ? daysOff : null,
    assessor_name: assessorName,
    assessor_email: assessorEmail,
    // "Launch opens the course to invites." Created from the wizard without
    // launching = a draft.
    launched_at: launch ? new Date().toISOString() : null,
    start_date: startDate,
    end_date: endDate,
    delivery_mode: deliveryMode as DeliveryMode,
  });

  if (error) {
    return { error: "Could not create the course. Try again." };
  }

  // Step 5's tutor invitation, sent through the same named-invitation path the
  // roster uses -- one code path, one email, one record. A failure here never
  // fails the launch: the course exists, and the invitation can be resent from
  // the roster.
  if (inviteEmail) {
    try {
      const { data: created } = await supabase
        .from("courses")
        .select("id")
        .eq("center_id", admin.center_id)
        .eq("name", name)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (created) {
        const { inviteToCourse } = await import("@/app/dashboard/admin/courses/[id]/invitation-actions");
        const fd = new FormData();
        fd.set("course_id", created.id);
        fd.set("email", inviteEmail);
        fd.set("role", "trainer");
        if (inviteRole) fd.set("tutor_role", inviteRole);
        await inviteToCourse({ error: null }, fd);
      }
    } catch {
      // Launch stands; the invitation can be sent from the roster.
    }
  }

  revalidatePath("/dashboard/admin");
  return { error: null };
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

// Duplicates a course's shape into a brand-new one under the same centre
// (cross-centre duplication isn't possible today -- an admin only ever has
// one centre_id, see project_admin_email_migration memory's parked
// super-admin item for when that might change). Ramy, 2026-08-05:
// duplicate "everything" except anything trainee-specific/private
// (records, grades, provisional/final reports, anything already exported
// to the centre's Drive) -- deliberately never queries any of those
// tables here at all, not just filters them out. TP Points Library and
// assignment briefs need no duplication logic since they're already
// centre-scoped (migrations 0013/0023), not course-scoped -- the new
// course already sees them for free. Input sessions aren't a built
// feature at all yet, nothing to carry over there either.
export async function duplicateCourse(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // for-claude-code-course-admin-final-scope.md: "Duplicate-course lives on
  // this overview (the course list), not inside an individual course's
  // detail." Reached from two different places now -- the old Course Admin
  // detail page (profile.role === "admin") and the new Centre Admin course
  // list (a centre_roles grant with course.create, e.g. centre_administrator
  // or centre_owner) -- so this accepts either, resolving whichever one
  // actually applies rather than assuming the admin-role path.
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) redirect("/login");
  let admin: { id: string; center_id: string };
  if (profile.role === "admin") {
    admin = { id: profile.id, center_id: profile.center_id };
  } else {
    const ctx = await getCentreRoleContext(profile);
    if (!can(ctx.roles, "course.create", ctx.overrides)) redirect(`/dashboard/${profile.role}`);
    admin = { id: profile.id, center_id: ctx.activeCenterId ?? profile.center_id };
  }

  const sourceCourseId = formData.get("source_course_id");
  const name = formData.get("name");
  const startDate = formData.get("start_date");
  const endDate = formData.get("end_date");

  if (
    typeof sourceCourseId !== "string" ||
    typeof name !== "string" ||
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    !sourceCourseId ||
    !name ||
    !startDate ||
    !endDate
  ) {
    return { error: "Fill in a name, start date, and end date." };
  }
  if (endDate < startDate) {
    return { error: "End date must be on or after the start date." };
  }

  const supabase = await createClient();

  const { data: source } = await supabase
    .from("courses")
    .select("id, center_id, start_date, delivery_mode")
    .eq("id", sourceCourseId)
    .maybeSingle();
  if (!source || source.center_id !== admin.center_id) {
    return { error: "Course not found." };
  }

  const { data: newCourse, error: createError } = await supabase
    .from("courses")
    .insert({
      center_id: admin.center_id,
      name,
      start_date: startDate,
      end_date: endDate,
      duplicated_from_course_id: source.id,
      delivery_mode: source.delivery_mode,
    })
    .select("id")
    .single();

  if (createError || !newCourse) {
    return { error: "Could not create the course. Try again." };
  }

  // Timetable: shift every event by the same day-offset from the OLD
  // start date onto the NEW one, so the whole course shape carries over.
  // Still just a normal editable timetable afterward, not locked -- "maybe
  // someone would just like to do the exact same course again" but also
  // wants to tweak it.
  const { data: events } = await supabase
    .from("course_timetable_events")
    .select("id, type, title, event_date, event_time, tag, linked_assignment_type, linked_tp_number")
    .eq("course_id", source.id);

  // Old event id -> new event id, by insert-row-order (a single multi-row
  // INSERT...RETURNING preserves input order in Postgres) -- lets a kept
  // announcement's anchor (below) point at the NEW course's corresponding
  // event instead of the old one, which for-claude-code-trainer-remaining-
  // screens.md's "always anchored ... so the set duplicates correctly"
  // depends on.
  const newEventIdByOldId = new Map<string, string>();
  if (events && events.length > 0) {
    const rows = events.map((e) => ({
      course_id: newCourse.id,
      type: e.type,
      title: e.title,
      event_date: addDays(startDate, daysBetween(source.start_date, e.event_date)),
      event_time: e.event_time,
      tag: e.tag,
      linked_assignment_type: e.linked_assignment_type,
      linked_tp_number: e.linked_tp_number,
      created_by: admin.id,
    }));
    const { data: newEvents } = await supabase.from("course_timetable_events").insert(rows).select("id");
    if (newEvents) {
      events.forEach((e, i) => {
        if (newEvents[i]) newEventIdByOldId.set(e.id, newEvents[i].id);
      });
    }
  }

  // Announcements: for-claude-code-trainer-remaining-screens.md's "keep
  // when the course duplicates" toggle -- only scheduled ones (anchored to
  // a timetable event) are meaningful to carry over; a one-off immediate
  // post from the old course has nothing to duplicate into.
  const { data: keptBroadcasts } = await supabase
    .from("course_broadcasts")
    .select("title, body, pinned, zoom_url, attachment_name, attachment_url, anchor_event_id, anchor_offset_days")
    .eq("course_id", source.id)
    .eq("keep_on_duplicate", true)
    .not("anchor_event_id", "is", null);

  const broadcastRows = (keptBroadcasts ?? [])
    .map((b) => {
      const newAnchorId = b.anchor_event_id ? newEventIdByOldId.get(b.anchor_event_id) : null;
      if (!newAnchorId) return null;
      return {
        course_id: newCourse.id,
        author_id: admin.id,
        title: b.title,
        body: b.body,
        pinned: b.pinned,
        zoom_url: b.zoom_url,
        attachment_name: b.attachment_name,
        attachment_url: b.attachment_url,
        anchor_event_id: newAnchorId,
        anchor_offset_days: b.anchor_offset_days,
        keep_on_duplicate: true,
        sent_at: null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (broadcastRows.length > 0) {
    await supabase.from("course_broadcasts").insert(broadcastRows);
  }

  // Resource Hub: only course-specific attachments need copying -- centre-
  // wide resources (course_id null) already show up on every course at
  // this centre automatically, nothing to duplicate there.
  const { data: resources } = await supabase
    .from("resources")
    .select("title, file_url, category, resource_type, description")
    .eq("course_id", source.id);

  if (resources && resources.length > 0) {
    await supabase.from("resources").insert(
      resources.map((r) => ({
        center_id: admin.center_id,
        course_id: newCourse.id,
        title: r.title,
        file_url: r.file_url,
        category: r.category,
        resource_type: r.resource_type,
        description: r.description,
        uploaded_by: admin.id,
      }))
    );
  }

  revalidatePath("/dashboard/admin");
  redirect(`/dashboard/admin/courses/${newCourse.id}`);
}
