import "server-only";

// Server-only speech-to-text, per for-claude-code-speech-to-text-integration.md:
// OpenAI's hosted transcription (gpt-4o-transcribe, falling back to
// whisper-1), chosen for cost (~$0.006/min) and its fit for informal,
// accented, non-studio recordings -- no live-streaming need here, so its
// lack of that is irrelevant. Never re-transcribes on demand: the caller
// stores the returned text once, alongside the audio, on the recording's
// own record.
//
// Non-fatal by design -- every call site treats a missing transcript the
// same way it already treats a failed audio upload: the underlying record
// is saved regardless, and a transcript can be regenerated later. Returns
// null rather than throwing so a missing OPENAI_API_KEY or a flaky API
// never blocks the submission it's attached to.
export async function transcribeAudio(audio: Blob | File, filename: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  for (const model of ["gpt-4o-transcribe", "whisper-1"]) {
    try {
      const form = new FormData();
      form.append("file", audio, filename);
      form.append("model", model);

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!response.ok) continue;

      const data = (await response.json()) as { text?: string };
      return data.text?.trim() || null;
    } catch {
      continue;
    }
  }
  return null;
}
