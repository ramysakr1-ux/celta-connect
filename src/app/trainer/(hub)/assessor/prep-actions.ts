"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

// Ticking a Handbook 14.1 item, and recording who said so.
//
// Ramy, 6 Sep 2026: the MCT and Course Admin both. Half the list is Course
// Admin's work -- candidate agreements, the application task, the attendance
// registers -- so requiring the MCT to tick would put the confirmation in the
// hands of someone who did not do it. RLS holds the real boundary (the course
// must belong to a centre the person holds); this checks they are staff at all.
//
// Append-only by design (migration 0282): unticking writes a second row rather
// than deleting the first, so "we said it was ready on Tuesday and unsaid it on
// Thursday" survives.

export interface PrepMarkResult {
  error: string | null;
}

export async function markPrepItem(_prev: PrepMarkResult, formData: FormData): Promise<PrepMarkResult> {
  const staff = await requireRole(["trainer", "admin"]);
  const courseId = staff.course_id;
  if (!courseId) return { error: "No course assigned." };

  const itemKey = formData.get("item_key");
  const done = formData.get("done") === "true";
  if (typeof itemKey !== "string" || itemKey.trim().length < 2) return { error: "Unknown item." };

  const supabase = await createClient();
  const { error } = await supabase.from("assessor_prep_marks").insert({
    course_id: courseId,
    item_key: itemKey,
    done,
    marked_by: staff.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/trainer/assessor");
  return { error: null };
}
