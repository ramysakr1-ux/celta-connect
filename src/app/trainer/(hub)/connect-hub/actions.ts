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
  // Accepts the raw Apps Script exec URL or a wrapper in front of it (e.g.
  // celta-hub-wrapper on GitHub Pages, which just forwards the query string
  // through to script.google.com) -- either is a real Connect Hub link, so
  // this only checks for a well-formed https URL carrying a tutor token,
  // not one specific domain.
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: "That doesn't look like a valid link." };
  }
  if (parsed.protocol !== "https:" || !parsed.searchParams.has("tutor")) {
    return { error: "That doesn't look like a Connect Hub tutor link -- it should be an https:// link with ?tutor=... in it." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ connect_hub_link: trimmed }).eq("id", profile.id);
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/trainer", "layout");
  redirect(trimmed);
}
