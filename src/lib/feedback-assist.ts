import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FeedbackTone } from "@/lib/supabase/types";

export interface FeedbackAssistState {
  enabled: boolean;
  isMct: boolean;
  customized: boolean;
  direct: string[];
  supportive: string[];
}

const EXAMPLES_PER_TONE = 3;

function padTo3(texts: string[]): string[] {
  const trimmed = texts.slice(0, EXAMPLES_PER_TONE);
  while (trimmed.length < EXAMPLES_PER_TONE) trimmed.push("");
  return trimmed;
}

async function getMctProfileId(courseId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("course_id", courseId)
    .eq("role", "trainer")
    .eq("tutor_role", "main_course_tutor")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

// Reset per course (Ramy, 2026-08-17) -- courseId + profileId together, never
// just profileId. An uncustomized tutor's "copy" is a live read of the MCT's
// rows, not a stored duplicate, so a later MCT edit reaches them for free and
// there is nothing to keep in sync.
export async function getFeedbackAssistState(courseId: string, profileId: string): Promise<FeedbackAssistState> {
  const supabase = await createClient();
  const mctId = await getMctProfileId(courseId);
  const isMct = mctId === profileId;

  const { data: settings } = await supabase
    .from("feedback_assist_settings")
    .select("enabled, customized_at")
    .eq("course_id", courseId)
    .eq("profile_id", profileId)
    .maybeSingle();

  const enabled = settings?.enabled ?? true;
  const customized = isMct ? true : Boolean(settings?.customized_at);
  const sourceProfileId = customized ? profileId : (mctId ?? profileId);

  const { data: examples } = await supabase
    .from("feedback_assist_examples")
    .select("tone, example_text")
    .eq("course_id", courseId)
    .eq("profile_id", sourceProfileId)
    .order("created_at", { ascending: true });

  const byTone = (tone: FeedbackTone) => padTo3((examples ?? []).filter((e) => e.tone === tone).map((e) => e.example_text));

  return {
    enabled,
    isMct,
    customized,
    direct: byTone("direct"),
    supportive: byTone("supportive"),
  };
}

export async function saveFeedbackAssistExamples(
  courseId: string,
  profileId: string,
  direct: string[],
  supportive: string[]
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("feedback_assist_examples")
    .delete()
    .eq("course_id", courseId)
    .eq("profile_id", profileId);
  if (deleteError) return { error: "Could not save your examples. Try again." };

  const rows = [
    ...direct.filter((t) => t.trim()).map((example_text) => ({ course_id: courseId, profile_id: profileId, tone: "direct" as FeedbackTone, example_text: example_text.trim() })),
    ...supportive.filter((t) => t.trim()).map((example_text) => ({ course_id: courseId, profile_id: profileId, tone: "supportive" as FeedbackTone, example_text: example_text.trim() })),
  ];
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("feedback_assist_examples").insert(rows);
    if (insertError) return { error: "Could not save your examples. Try again." };
  }

  const { error: settingsError } = await supabase
    .from("feedback_assist_settings")
    .upsert({ course_id: courseId, profile_id: profileId, customized_at: new Date().toISOString() }, { onConflict: "course_id,profile_id" });
  if (settingsError) return { error: "Could not save your examples. Try again." };

  return { error: null };
}

export async function setFeedbackAssistEnabled(courseId: string, profileId: string, enabled: boolean): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback_assist_settings")
    .upsert({ course_id: courseId, profile_id: profileId, enabled }, { onConflict: "course_id,profile_id" });
  return { error: error ? "Could not save that. Try again." : null };
}
