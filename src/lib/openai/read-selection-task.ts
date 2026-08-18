import "server-only";

// specs/build-spec.md "Marking scheme for the selection task": five rows,
// each Above/At/Below standard, a required note on any Below --
// language_awareness, then accuracy/organisation/range/substance on the
// writing. This reads a submission against that same centre scheme, never
// against a general notion of quality (twenty-decisions.md 11a: "the app
// never writes a rejection, at any confidence, under any setting" --
// this function never returns a verdict on the applicant, only a reading
// of the task, and it is always a suggestion: marking-form.tsx already
// shows it as "Suggested -- not sent" beside the tutor's own marks, never
// pre-filled into them).
//
// Non-fatal by design, same pattern as transcribe.ts: returns null on a
// missing key or any failure so a flaky API or unset OPENAI_API_KEY never
// blocks an application being recorded.

export type SelectionTaskRowKey = "language_awareness" | "accuracy" | "organisation" | "range" | "substance";

export interface SelectionTaskRowReading {
  level: "above" | "at" | "below";
  note: string | null;
}

export interface SelectionTaskReading {
  language_awareness: SelectionTaskRowReading;
  accuracy: SelectionTaskRowReading;
  organisation: SelectionTaskRowReading;
  range: SelectionTaskRowReading;
  substance: SelectionTaskRowReading;
  summary: string;
}

const ROW_KEYS: SelectionTaskRowKey[] = ["language_awareness", "accuracy", "organisation", "range", "substance"];

const SYSTEM_PROMPT = `You are reading a CELTA pre-interview selection task submission for a centre, against that centre's own marking scheme. You are not deciding whether to accept, reject, or interview the applicant -- only assessing the quality of what they submitted, as a starting point for a tutor who will review it themselves.

Score five rows, each "above" (above standard), "at" (at standard), or "below" (below standard):
- language_awareness: the language-awareness questions (identifying and correcting language errors).
- accuracy, organisation, range, substance: the extended writing task.

Every "below" row MUST carry a short note (under 200 characters) citing specifically what is missing or wrong in the text -- never a vague judgement. "above" and "at" rows may have a null note.

Also write a 2-3 sentence summary a tutor could use as a starting point for what to say about the task, in plain prose, citing specifics from the submission the same way the notes do.

Respond with strict JSON only, no other text, in exactly this shape:
{"language_awareness":{"level":"above|at|below","note":"string or null"},"accuracy":{...},"organisation":{...},"range":{...},"substance":{...},"summary":"string"}`;

function isValidRow(row: unknown): row is SelectionTaskRowReading {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  if (r.level !== "above" && r.level !== "at" && r.level !== "below") return false;
  if (r.note !== null && typeof r.note !== "string") return false;
  if (r.level === "below" && (!r.note || typeof r.note !== "string" || r.note.trim().length === 0)) return false;
  return true;
}

function parseReading(content: string): SelectionTaskReading | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.summary !== "string" || !parsed.summary.trim()) return null;
    for (const key of ROW_KEYS) {
      if (!isValidRow(parsed[key])) return null;
    }
    return parsed as unknown as SelectionTaskReading;
  } catch {
    return null;
  }
}

export async function readSelectionTask(input: {
  languageAwarenessQA: { question: string; answer: string }[];
  writingPrompt: string | null;
  writingSubmission: string | null;
}): Promise<SelectionTaskReading | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (input.languageAwarenessQA.length === 0 && !input.writingSubmission?.trim()) return null;

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
          {
            role: "user",
            content: JSON.stringify({
              languageAwarenessQuestions: input.languageAwarenessQA,
              writingTaskPrompt: input.writingPrompt,
              writingTaskSubmission: input.writingSubmission,
            }),
          },
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
