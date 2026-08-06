"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

export async function createCourse(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireRole("admin");

  const name = formData.get("name");
  const startDate = formData.get("start_date");
  const endDate = formData.get("end_date");

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

  const supabase = await createClient();
  const { error } = await supabase.from("courses").insert({
    center_id: admin.center_id,
    name,
    start_date: startDate,
    end_date: endDate,
  });

  if (error) {
    return { error: "Could not create the course. Try again." };
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
  const admin = await requireRole("admin");

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
    .select("id, center_id, start_date")
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
    .select("type, title, event_date, event_time, tag, linked_assignment_type, linked_tp_number")
    .eq("course_id", source.id);

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
    await supabase.from("course_timetable_events").insert(rows);
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
