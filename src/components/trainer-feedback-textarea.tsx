"use client";

import { useRef, useState, useTransition } from "react";
import { VoiceTextarea, type VoiceTextareaProps } from "@/components/voice-textarea";
import { cleanupFeedbackTone } from "@/app/dashboard/trainer/tone-cleanup-actions";

export function TrainerFeedbackTextarea(props: VoiceTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeTone, setActiveTone] = useState<"direct" | "supportive" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCleanup(tone: "direct" | "supportive") {
    const text = textareaRef.current?.value.trim();
    if (!text) {
      setError("Write or dictate some feedback first.");
      return;
    }
    setError(null);
    setActiveTone(tone);
    startTransition(async () => {
      const result = await cleanupFeedbackTone(text, tone);
      if (result.error) {
        setError(result.error);
      } else if (textareaRef.current && result.text) {
        textareaRef.current.value = result.text;
      }
      setActiveTone(null);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleCleanup("direct")}
          className="text-xs text-muted hover:text-ink disabled:opacity-60"
        >
          {isPending && activeTone === "direct" ? "Rewriting…" : "Direct tone"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleCleanup("supportive")}
          className="text-xs text-muted hover:text-ink disabled:opacity-60"
        >
          {isPending && activeTone === "supportive" ? "Rewriting…" : "Supportive tone"}
        </button>
      </div>
      <VoiceTextarea ref={textareaRef} {...props} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
