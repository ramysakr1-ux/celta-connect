"use client";

import { useRef, useState, useTransition } from "react";
import { autosizeOnInput, fitToContent } from "@/lib/autosize";
import { cleanupFeedbackToneForCourse } from "@/app/dashboard/trainer/tone-cleanup-actions";

type VoiceTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

// Feedback Assist's per-tutor sibling to TrainerFeedbackTextarea, used only
// where a tutor's own examples apply (TP feedback) -- assignment feedback
// keeps the centre-wide original untouched. "Encouraging" matches the
// handoff's copy; the underlying wire value stays "supportive" (FeedbackTone)
// to avoid an enum rename touching feedback_style_examples too.
export function TutorToneTextarea({ enabled, ...props }: VoiceTextareaProps & { enabled: boolean }) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // No mic of its own: the feedback form has ONE recogniser behind two Dictate
  // buttons (identity band and bottom bar) and it types into whichever box has
  // the cursor -- this one included. The tone links stay.
  const attach = (el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
    fitToContent(el);
  };
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
    return <textarea ref={attach} onInput={autosizeOnInput} {...props} />;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleCleanup("direct")}
          className="text-[11.5px] text-muted hover:text-ink disabled:opacity-60"
        >
          {isPending && activeTone === "direct" ? "Rewriting…" : "Direct tone"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleCleanup("supportive")}
          className="text-[11.5px] text-muted hover:text-ink disabled:opacity-60"
        >
          {isPending && activeTone === "supportive" ? "Rewriting…" : "Supportive tone"}
        </button>
      </div>
      <textarea ref={attach} onInput={autosizeOnInput} {...props} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
