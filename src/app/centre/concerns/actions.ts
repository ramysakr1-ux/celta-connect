"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";

export interface CentreConcernFormState {
  error: string | null;
}

// Answering a concern a candidate sent past their tutors.
//
// Separate from the trainer inbox's replyToConcern on purpose. That one scopes
// by the replier's own course_id, which a centre administrator does not have,
// and migration 0280 now stops a trainer updating a manager-routed row at all.
// This one gates on the capability instead, and RLS's admin policy is what
// actually permits the write.
export async function replyToCentreConcern(
  _prev: CentreConcernFormState,
  formData: FormData
): Promise<CentreConcernFormState> {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");

  const ctx = await getCentreRoleContext(session.profile);
  if (!can(ctx.roles, "concerns.manage", ctx.overrides)) {
    return { error: "You do not hold the role that answers these." };
  }

  const concernId = formData.get("concern_id");
  const response = (formData.get("response") as string | null)?.trim();
  if (typeof concernId !== "string" || !concernId || !response) {
    return { error: "Write a reply first." };
  }

  const supabase = await createClient();
  // route is re-checked here as well as in RLS: this action exists only for
  // the manager route, and a concern addressed to a tutor should be answered
  // in the tutors' own inbox where they can see the conversation.
  const { error } = await supabase
    .from("concerns")
    .update({ response, responded_at: new Date().toISOString(), responded_by: session.profile.id })
    .eq("id", concernId)
    .eq("route", "manager");
  if (error) return { error: error.message };

  revalidatePath("/centre/concerns");
  return { error: null };
}
