"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

export interface FormState {
  error: string | null;
}

// Connect Hub (a separate Google Apps Script project) has no login of its
// own -- access is a token baked into a URL. There's no session to bridge,
// so this just saves the personal tutor link a trainer/admin already has
// from Connect Hub's own "Tutors" tab, so they don't need to keep it
// bookmarked separately. One link per person, not centre-wide.
export async function saveConnectHubLink(_prevState: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireRole(["trainer", "admin"]);
  const link = formData.get("connect_hub_link");
  if (typeof link !== "string" || !link.trim()) {
    return { error: "Paste your Connect Hub tutor link first." };
  }
  const trimmed = link.trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\?tutor=.+/.test(trimmed)) {
    return { error: "That doesn't look like a Connect Hub tutor link (should start with https://script.google.com/macros/s/... and include ?tutor=)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ connect_hub_link: trimmed }).eq("id", profile.id);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/trainer", "layout");
  redirect(trimmed);
}
