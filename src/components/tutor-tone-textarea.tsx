"use client";

import { useRef, useState, useTransition } from "react";
import { VoiceTextarea, type VoiceTextareaProps } from "@/components/voice-textarea";
import { cleanupFeedbackToneForCourse } from "@/app/dashboard/trainer/tone-cleanup-actions";

// Feedback Assist's per-tutor sibling to TrainerFeedbackTextarea, used only
// where a tutor's own examples apply (TP feedback) -- assignment feedback
// keeps the centre-wide original untouched. "Encouraging" matches the
// handoff's copy; the underlying wire value stays "supportive" (FeedbackTone)
// to avoid an enum rename touching feedback_style_examples too.
export function TutorToneTextarea({ enabled, ...props }: VoiceTextareaProps & { enabled: boolean }) {
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
      const result = await cleanupFeedbackToneForCourse(text, tone);
      if (result.error) {
        setError(result.error);
      } else if (textareaRef.current && result.text) {
        textareaRef.current.value = result.text;
      }
      setActiveTone(null);
    });
  }

  if (!enabled) {
    return <VoiceTextarea ref={textareaRef} {...props} />;
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
          {isPending && activeTone === "supportive" ? "Rewriting…" : "Encouraging tone"}
        </button>
      </div>
      <VoiceTextarea ref={textareaRef} {...props} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
