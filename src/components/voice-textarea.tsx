"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type VoiceTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

// Only one dictation session should be active across the whole app at a
// time -- starting a new one stops whichever was previously listening.
let stopActiveRecognition: (() => void) | null = null;

function joinText(base: string, addition: string): string {
  if (!addition) return base;
  if (!base) return addition;
  return /[\s\n]$/.test(base) ? base + addition : `${base} ${addition}`;
}

// Spoken punctuation commands, applied only to finalized (settled) speech --
// not interim results, which change too fast for this to look right.
const PUNCTUATION_COMMANDS: [RegExp, string][] = [
  [/\bfull stop\b/gi, "."],
  [/\bperiod\b/gi, "."],
  [/\bcomma\b/gi, ","],
  [/\bquestion mark\b/gi, "?"],
  [/\bexclamation (?:mark|point)\b/gi, "!"],
  [/\bnew paragraph\b/gi, "\n\n"],
  [/\bnew line\b/gi, "\n"],
  [/\bcolon\b/gi, ":"],
  [/\bsemicolon\b/gi, ";"],
  [/\bdot dot dot\b/gi, "..."],
  [/\b(?:dash|hyphen)\b/gi, "-"],
  [/\bopen parenthesis\b/gi, "("],
  [/\bclose parenthesis\b/gi, ")"],
  [/\bopen quote\b/gi, '"'],
  [/\bclose quote\b/gi, '"'],
  [/\bapostrophe\b/gi, "'"],
];

function applyPunctuationCommands(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PUNCTUATION_COMMANDS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/[ \t]+([.,!?:;)])/g, "$1").replace(/[ \t]{2,}/g, " ");
}

export const VoiceTextarea = forwardRef<HTMLTextAreaElement, VoiceTextareaProps>(
  function VoiceTextarea(props, forwardedRef) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement);

    const [supported, setSupported] = useState(false);
    const [listening, setListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const baseValueRef = useRef("");
    const finalTranscriptRef = useRef("");
    const userStoppedRef = useRef(true);

    // Feature-detected client-side only, to avoid an SSR/client render mismatch.
    useEffect(() => {
      setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    }, []);

    useEffect(() => {
      return () => {
        userStoppedRef.current = true;
        recognitionRef.current?.abort();
      };
    }, []);

    function handleStop() {
      userStoppedRef.current = true;
      recognitionRef.current?.stop();
    }

    function handleStart() {
      const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      const textarea = innerRef.current;
      if (!SpeechRecognitionCtor || !textarea) return;

      stopActiveRecognition?.();
      stopActiveRecognition = handleStop;

      setError(null);
      userStoppedRef.current = false;
      baseValueRef.current = textarea.value;
      finalTranscriptRef.current = "";

      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) finalChunk += transcript;
          else interimChunk += transcript;
        }
        if (finalChunk) {
          finalTranscriptRef.current = applyPunctuationCommands(
            joinText(finalTranscriptRef.current, finalChunk)
          );
        }
        const target = innerRef.current;
        if (!target) return;
        const committed = joinText(baseValueRef.current, finalTranscriptRef.current);
        target.value = joinText(committed, interimChunk);
        target.dispatchEvent(new Event("input", { bubbles: true }));
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setError(
          event.error === "not-allowed" ? "Microphone access denied." : "Dictation error. Try again."
        );
      };

      recognition.onend = () => {
        if (!userStoppedRef.current) {
          try {
            recognition.start();
            return;
          } catch {
            // fall through to idle below
          }
        }
        setListening(false);
        if (stopActiveRecognition === handleStop) stopActiveRecognition = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
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
