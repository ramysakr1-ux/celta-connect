import "server-only";

// Companion to read-selection-task.ts, but deliberately separate: the
// speaking task was never part of that function's 5-row marking scheme
// (language_awareness/accuracy/organisation/range/substance -- Admin
// Handbook 7.3's writing/language-awareness scheme only), so this doesn't
// feed deriveTriageLane, auto-booking, or the clear-problems notification.
// It's a standalone, read-only suggestion next to the recording -- same
// "starting point for a tutor, never a verdict" framing as the writing
// task's reading.
export async function readSpeakingTask(input: { prompt: string | null; transcript: string }): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!input.transcript.trim()) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are reading the transcript of a CELTA applicant's pre-interview speaking task recording, for a tutor who will listen to it themselves. You are not deciding whether to accept, reject, or interview the applicant -- only giving a short, plain-prose starting point for what a tutor might notice about the applicant's spoken English (fluency, range, accuracy, coherence), citing specifics from the transcript. 2-3 sentences, no headings, no scoring, no verdict.",
          },
          {
            role: "user",
            content: JSON.stringify({ speakingPrompt: input.prompt, transcript: input.transcript }),
          },
        ],
      }),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}
