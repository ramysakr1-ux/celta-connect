"use server";

import { revalidatePath } from "next/cache";
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
