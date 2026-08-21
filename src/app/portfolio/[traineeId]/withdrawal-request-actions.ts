"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface WithdrawalRequestFormState {
  error: string | null;
  sent?: boolean;
}

export const WITHDRAWAL_REASON_TAGS = [
  "Personal circumstances",
  "Health",
  "Work commitments",
  "Financial",
  "The course is not right for me",
  "Prefer not to say",
] as const;

export const WITHDRAW_CONFIRMATIONS = [
  "I understand that withdrawing is final and cannot be reversed on this course.",
  "I understand that no further teaching practice will be scheduled and no further work of mine will be assessed.",
  "I understand my portfolio will be closed as it stands and retained by the centre.",
  "I understand that if I have been entered with Cambridge, my result will be reported as a withdrawal.",
] as const;

export const DEFER_CONFIRMATIONS = [
  "I understand a deferral is a request, not a decision, and depends on the centre agreeing and a place being available.",
  "I understand my portfolio will be frozen from my last day and no further work will be assessed until I return.",
  "I understand my work carries forward to the course I join, and that the centre will confirm what counts towards completion.",
  "I understand that if I do not return, the centre may record this as a withdrawal.",
] as const;

// Withdrawal Form.dc.html: the candidate's own request, not an execution of
// it. Creates a pending withdrawal_requests row that the trainer sees and
// actions from withdraw-card.tsx (withdrawTrainee / markForDeferral) --
// this action never touches profiles.course_status itself.
export async function submitWithdrawalRequest(_prevState: WithdrawalRequestFormState, formData: FormData): Promise<WithdrawalRequestFormState> {
  const traineeId = formData.get("trainee_id");
  const kind = formData.get("kind");
  const reasonTag = (formData.get("reason_tag") as string | null) || null;
  const note = ((formData.get("note") as string | null) ?? "").trim() || null;
  const effectiveDate = (formData.get("effective_date") as string | null) || null;
  const stillAttending = kind === "withdraw" ? formData.get("still_attending") === "yes" : null;
  const signedName = (formData.get("signed_name") as string | null)?.trim();
  const confirmedRaw = formData.getAll("confirmed");

  if (typeof traineeId !== "string" || !traineeId) return { error: "Something went wrong. Refresh and try again." };
  if (kind !== "withdraw" && kind !== "defer") return { error: "Choose what you're asking for." };
  if (!effectiveDate) return { error: kind === "withdraw" ? "Set your last day on the course." : "Set your last day you'll attend." };
  if (!signedName) return { error: "Type your full name to sign." };

  const expectedConfirmations = kind === "withdraw" ? WITHDRAW_CONFIRMATIONS : DEFER_CONFIRMATIONS;
  const confirmed = confirmedRaw.filter((v): v is string => typeof v === "string");
  if (confirmed.length !== expectedConfirmations.length) {
    return { error: "Please confirm every statement before signing." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== traineeId) return { error: "Not signed in." };

  const { data: profile } = await supabase.from("profiles").select("course_id, course_status").eq("id", user.id).maybeSingle();
  if (!profile?.course_id) return { error: "No course assigned." };
  if (profile.course_status !== "active") return { error: "Your course status has already been recorded -- talk to your tutor." };

  const { data: existing } = await supabase
    .from("withdrawal_requests")
    .select("id")
    .eq("trainee_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return { error: "You already have a pending request awaiting the centre." };

  const { error } = await supabase.from("withdrawal_requests").insert({
    trainee_id: user.id,
    course_id: profile.course_id,
    kind,
    reason_tag: reasonTag,
    note,
    effective_date: effectiveDate,
    still_attending: stillAttending,
    confirmations: confirmed,
    signed_name: signedName,
  });
  if (error) return { error: "Could not send. Try again." };

  revalidatePath(`/portfolio/${traineeId}/withdrawal-request`);
  return { error: null, sent: true };
}
