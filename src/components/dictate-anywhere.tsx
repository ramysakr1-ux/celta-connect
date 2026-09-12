"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { dictationSupported, isDictationField, startDictation, type DictationField } from "@/lib/dictation";

// One microphone for a whole form, instead of a small one clipped under five
// of its boxes and missing from the rest.
//
// Ramy, 12 Sep 2026: "Why do we have [microphones] under main aims, sub aims,
// personal aims, but not anticipated problems and solutions? ... Why can't we
// have just one microphone... whichever box has the cursor, that's when it
// starts dictating."
//
// It follows the cursor: the last text box you clicked inside `scopeId` is the
// one it types into, and clicking a different box mid-session moves the
// dictation there. Sitting in the sticky submit bar, it is on screen wherever
// you are in the form -- including the procedure table, which never had
// dictation at all.

export function DictateAnywhere({ scopeId }: { scopeId: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const fieldRef = useRef<DictationField | null>(null);
  const sessionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => setSupported(dictationSupported()), []);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!isDictationField(target)) return;
      if (!document.getElementById(scopeId)?.contains(target)) return;
      fieldRef.current = target;
      setLabel(describeField(target));
    };
    window.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("focusin", onFocusIn);
      sessionRef.current?.stop();
    };
  }, [scopeId]);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setListening(false);
  }, []);

  function start() {
    const field = fieldRef.current;
    if (!field || !field.isConnected) {
      setError("Click inside a box first, then Dictate.");
      return;
    }
    setError(null);
    field.focus();
    const session = startDictation({
      field,
      // Re-read on every result so the cursor, not the click that started the
      // session, decides where the words land.
      resolveField: () => {
        const active = document.activeElement;
        if (isDictationField(active) && document.getElementById(scopeId)?.contains(active)) return active;
        return fieldRef.current;
      },
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

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
          listening
            ? "border-destructive bg-status-warning-bg text-destructive"
            : "border-border text-ink trainee-hover-fill"
        }`}
      >
        {listening ? <Square size={13} className="fill-current" /> : <Mic size={14} />}
        {listening ? "Stop" : "Dictate"}
      </button>
      <p className="text-[11px] leading-tight text-muted">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : listening ? (
          `Listening — speak into ${label ?? "the box"}`
        ) : label ? (
          `Into ${label}`
        ) : (
          "Click a box, then speak"
        )}
      </p>
    </div>
  );
}

// The name a trainee would use for the box, in this order: an explicit label
// set by the form, the field's own label element, its placeholder.
function describeField(field: DictationField): string | null {
  const explicit = field.getAttribute("data-dictate-label");
  if (explicit) return explicit;

  const id = field.getAttribute("id");
  if (id) {
    const forLabel = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    const text = forLabel?.textContent?.trim();
    if (text) return text;
  }
  const wrapping = field.closest("label")?.textContent?.trim();
  if (wrapping) return wrapping;

  const placeholder = field.getAttribute("placeholder")?.trim();
  if (placeholder) return placeholder;
  return null;
}
