"use server";

import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ConcernFormState {
  error: string | null;
  sent?: boolean;
}

// Enrolment Forms.dc.html 1c. Course-wide staff visibility (see migration
// 0140) -- "the centre replies to every concern," not one gatekept
// individual reading a routing table.
export async function submitConcern(_prevState: ConcernFormState, formData: FormData): Promise<ConcernFormState> {
  const traineeId = formData.get("trainee_id");
  const route = formData.get("route");
  const body = (formData.get("body") as string | null)?.trim();
  const anonymous = formData.get("anonymous") === "on";

  if (typeof traineeId !== "string" || !traineeId) return { error: "Something went wrong. Refresh and try again." };
  if (typeof route !== "string" || !["tutor", "mct", "manager"].includes(route)) return { error: "Choose who should see this." };
  if (!body) return { error: "Say what's happened." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== traineeId) return { error: "Not signed in." };

  const { data: profile } = await supabase.from("profiles").select("course_id").eq("id", user.id).maybeSingle();
  if (!profile?.course_id) return { error: "No course assigned." };

  const { error } = await supabase.from("concerns").insert({
    course_id: profile.course_id,
    trainee_id: user.id,
    route: route as "tutor" | "mct" | "manager",
    body,
    anonymous,
  });
  if (error) return { error: "Could not send. Try again." };

  return { error: null, sent: true };
}
