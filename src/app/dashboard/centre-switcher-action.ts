"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export interface SwitchCentreState {
  error?: string;
}

/**
 * Sets which centre this person is acting in.
 *
 * The switch is only a preference: current_center_id() (migration 0103) will
 * not honour active_center_id unless a live centre_roles grant backs it, so
 * even if this wrote a centre the person holds nothing in, RLS would keep
 * returning their home centre and they would see nothing new. The check below
 * exists so the UI refuses honestly rather than silently appearing to switch.
 */
export async function switchCentre(_prev: SwitchCentreState, formData: FormData): Promise<SwitchCentreState> {
  const profile = await requireRole("admin");
  const centerId = formData.get("center_id") as string | null;
  if (!centerId) return { error: "Which centre?" };

  const supabase = await createClient();

  if (centerId !== profile.center_id) {
    const { data: grant } = await supabase
      .from("centre_roles")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("center_id", centerId)
      .is("revoked_at", null)
      .maybeSingle();
    if (!grant) return { error: "You don't hold a role in that centre." };
  }

  const { error } = await supabase.from("profiles").update({ active_center_id: centerId }).eq("id", profile.id);
  if (error) return { error: "Could not switch centre." };

  // Everything under /dashboard is centre-scoped, so the whole subtree is
  // stale the moment this changes.
  revalidatePath("/dashboard", "layout");
  return {};
}
