"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

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

  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("end_date").eq("id", trainer.course_id).maybeSingle();
  if (!course) return { error: "Could not find your course." };

  const { data: volunteer, error } = await supabase
    .from("volunteer_students")
    .insert({ course_id: trainer.course_id, name })
    .select("id")
    .single();

  if (error || !volunteer) return { error: "Could not add the student. Try again." };

  const expiresAt = new Date(`${course.end_date}T23:59:59Z`).toISOString();
  const { error: tokenError } = await supabase.from("course_access_tokens").insert({
    course_id: trainer.course_id,
    role: "volunteer_student",
    volunteer_student_id: volunteer.id,
    expires_at: expiresAt,
  });

  if (tokenError) return { error: "Added the student, but could not create their link. Try again." };

  revalidatePath("/trainer/volunteers");
  return { error: null };
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

  if (error || !created) return { token: null, error: "Could not create the link. Try again." };
  return { token: created.token, error: null };
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
