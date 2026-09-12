"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { dictationSupported, startDictation, type DictationSession } from "@/lib/dictation";

export type VoiceTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

// A textarea with its own microphone underneath. The speech engine itself now
// lives in src/lib/dictation.ts, shared with DictateAnywhere -- the one-button
// version used on the lesson plan, where a mic under every box was both
// cluttered and incomplete (Ramy, 12 Sep 2026).
//
// This stays for the forms that are one long box, or a short list of them,
// where a mic per box is the clearer control: written assignments, the
// self-evaluation, tutor feedback, the trainer capture form, TP point review.

export const VoiceTextarea = forwardRef<HTMLTextAreaElement, VoiceTextareaProps>(
  function VoiceTextarea(props, forwardedRef) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement);

    const [supported, setSupported] = useState(false);
    const [listening, setListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sessionRef = useRef<DictationSession | null>(null);

    // Feature-detected client-side only, to avoid an SSR/client render mismatch.
    useEffect(() => setSupported(dictationSupported()), []);

    useEffect(() => {
      return () => sessionRef.current?.stop();
    }, []);

    function handleStop() {
      sessionRef.current?.stop();
      sessionRef.current = null;
      setListening(false);
    }

    function handleStart() {
      const textarea = innerRef.current;
      if (!textarea) return;
      setError(null);
      const session = startDictation({
        field: textarea,
        onError: (message) => setError(message),
        onEnd: () => {
          sessionRef.current = null;
          setListening(false);
        },
      });
      if (!session) return;
      sessionRef.current = session;
      setListening(true);
    }

    return (
      <div className="flex flex-col gap-1">
        <textarea ref={innerRef} {...props} />
        {supported ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={listening ? handleStop : handleStart}
              className="self-start text-xs text-muted hover:text-ink"
            >
              {listening ? "■ Stop — listening…" : "🎙 Dictate"}
            </button>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        ) : null}
      </div>
    );
  }
);
