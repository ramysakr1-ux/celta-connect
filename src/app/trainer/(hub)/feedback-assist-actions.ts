"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { saveFeedbackAssistExamples, setFeedbackAssistEnabled } from "@/lib/feedback-assist";

export interface FeedbackAssistFormState {
  error: string | null;
}

export async function saveFeedbackAssistAction(
  _prevState: FeedbackAssistFormState,
  formData: FormData
): Promise<FeedbackAssistFormState> {
  const trainer = await requireRole("trainer");
  if (!trainer.course_id) return { error: "No course assigned." };

  const direct = formData.getAll("direct").map((v) => String(v));
  const supportive = formData.getAll("supportive").map((v) => String(v));

  const { error } = await saveFeedbackAssistExamples(trainer.course_id, trainer.id, direct, supportive);
  if (error) return { error };

  revalidatePath("/trainer");
  return { error: null };
}

export async function toggleFeedbackAssistEnabledAction(enabled: boolean): Promise<{ error: string | null }> {
  const trainer = await requireRole("trainer");
  if (!trainer.course_id) return { error: "No course assigned." };

  const result = await setFeedbackAssistEnabled(trainer.course_id, trainer.id, enabled);
  revalidatePath("/trainer");
  return result;
}
