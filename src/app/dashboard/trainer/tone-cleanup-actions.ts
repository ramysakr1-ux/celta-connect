"use server";

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAnthropicClient, getAnthropicModel } from "@/lib/anthropic/client";
import type { FeedbackTone } from "@/lib/supabase/types";

export interface CleanupResult {
  text: string | null;
  error: string | null;
}

const MAX_EXAMPLES_PER_TONE = 5;
const MAX_INPUT_LENGTH = 4000;
const GENERIC_ERROR = "Could not rewrite that. Try again.";

export async function cleanupFeedbackTone(
  rawText: string,
  tone: FeedbackTone
): Promise<CleanupResult> {
  const profile = await requireRole("trainer");

  if (tone !== "direct" && tone !== "supportive") {
    return { text: null, error: "Invalid tone." };
  }
  const text = rawText.trim();
  if (!text) return { text: null, error: "Nothing to rewrite yet." };
  if (text.length > MAX_INPUT_LENGTH) {
    return { text: null, error: "That's too long to rewrite in one go." };
  }

  const supabase = await createClient();
  const { data: examples } = await supabase
    .from("feedback_style_examples")
    .select("example_text")
    .eq("center_id", profile.center_id)
    .eq("tone", tone)
    .order("created_at", { ascending: false })
    .limit(MAX_EXAMPLES_PER_TONE);

  try {
    const anthropic = createAnthropicClient();
    const response = await anthropic.messages.create({
      model: getAnthropicModel(),
      max_tokens: 1024,
      system: buildSystemPrompt(tone, examples?.map((e) => e.example_text) ?? []),
      messages: [{ role: "user", content: text }],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text" || !block.text.trim()) {
      return { text: null, error: GENERIC_ERROR };
    }
    return { text: block.text.trim(), error: null };
  } catch {
    return { text: null, error: GENERIC_ERROR };
  }
}

function buildSystemPrompt(tone: FeedbackTone, examples: string[]): string {
  const toneDescription =
    tone === "direct"
      ? "direct: clear, concise, unambiguous about what needs to change, no hedging, action-oriented"
      : "supportive: warm, encouraging, leads with strengths, frames improvement areas gently";

  const examplesBlock =
    examples.length > 0
      ? `Here are real examples of ${tone} feedback previously written at this training center, to match voice, register, and vocabulary:\n\n` +
        examples.map((e, i) => `Example ${i + 1}:\n"""${e}"""`).join("\n\n")
      : "";

  return `You are helping a CELTA trainer rewrite draft feedback about a trainee's teaching practice into a ${toneDescription} tone.

Rewrite the trainer's input below to have a ${tone} tone, while:
- Preserving all factual content, specific observations, and examples from the original -- do not invent new claims or drop substantive feedback.
- Keeping roughly the same length as the input.
- Using natural, professional feedback-writing style appropriate for a CELTA candidate record.

${examplesBlock}

Return ONLY the rewritten feedback text, with no preamble, labels, or commentary.`;
}
