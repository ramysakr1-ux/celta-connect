import "server-only";

// connect-decision-language-precheck.md: a lightweight model call, not
// word-level heuristics -- register judgment is exactly the kind of thing
// heuristics (word lists, sentence-length thresholds) get wrong in both
// directions. Advisory only, same "flag, never block" shape as
// readSelectionTask.ts: never a verdict on the candidate, just a nudge for
// the tutor to look closer. Non-fatal by design, same pattern as
// transcribe.ts/read-selection-task.ts -- returns null on a missing key or
// any failure so a flaky API or unset OPENAI_API_KEY never blocks a
// submission being recorded.

export interface AssignmentRegisterReading {
  flagged: boolean;
  note: string | null;
}

const SYSTEM_PROMPT = `You are reading a CELTA written assignment submission for whether it reads as genuine academic assignment-register prose, or reads as something else -- e.g. clearly informal/conversational writing pasted in, or text that reads as machine-translated rather than composed English. You are judging REGISTER only -- not grammar accuracy, not content quality, not plagiarism, not whether the ideas are good.

This is advisory only, for a tutor to look at more closely -- never a verdict, never evidence of anything on its own. Most submissions read as fine academic prose and should not be flagged. Only flag when the register genuinely reads as off across a meaningful stretch of the text, not for one casual phrase inside otherwise normal academic writing.

Respond with strict JSON only, no other text, in exactly this shape:
{"flagged": boolean, "note": "string or null"}

If flagged is true, note must be a short (under 200 characters), specific, non-accusatory observation phrased as a suggestion for the tutor to check, e.g. "Reads as informal/conversational in several sections -- worth a look" or "Several passages read as machine-translated rather than composed English -- worth a look." If flagged is false, note must be null.`;

function parseReading(content: string): AssignmentRegisterReading | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.flagged !== "boolean") return null;
    if (parsed.flagged && (typeof parsed.note !== "string" || !parsed.note.trim())) return null;
    if (!parsed.flagged && parsed.note !== null) return null;
    return parsed as unknown as AssignmentRegisterReading;
  } catch {
    return null;
  }
}

export async function readAssignmentRegister(bodyText: string): Promise<AssignmentRegisterReading | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!bodyText.trim()) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          // Long assignments can run well past a mini-model's comfortable
          // context -- 12000 chars (~2500 words) is generous for any single
          // CELTA written assignment and keeps the call cheap and fast.
          { role: "user", content: bodyText.slice(0, 12000) },
        ],
      }),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    return parseReading(content);
  } catch {
    return null;
  }
}
