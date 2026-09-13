"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { dictationSupported, isDictationField, startDictation, type DictationField } from "@/lib/dictation";

// One microphone for a whole form, instead of a small one clipped under some
// of its boxes and missing from the rest.
//
// Ramy, 12 Sep 2026: "Why do we have [microphones] under main aims, sub aims,
// personal aims, but not anticipated problems and solutions? ... Why can't we
// have just one microphone... whichever box has the cursor, that's when it
// starts dictating."
//
// design_handoff_trainee_lesson_plan §8 then asked for TWO buttons -- one in
// the identity band, one in the fixed bottom bar -- driving ONE recogniser, so
// the control is in reach whether you are at the top of the plan or the
// bottom. Hence the provider: the buttons are views onto a single session, and
// the session follows the cursor.

type DictationState = {
  supported: boolean;
  listening: boolean;
  error: string | null;
  fieldLabel: string | null;
  toggle: () => void;
};

const DictationContext = createContext<DictationState | null>(null);

export function DictationScope({ scopeId, children }: { scopeId: string; children: React.ReactNode }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldLabel, setFieldLabel] = useState<string | null>(null);
  const fieldRef = useRef<DictationField | null>(null);
  const sessionRef = useRef<{ stop: () => void } | null>(null);
  const startRef = useRef<(() => void) | null>(null);

  useEffect(() => setSupported(dictationSupported()), []);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!isDictationField(target)) return;
      if (!document.getElementById(scopeId)?.contains(target)) return;
      fieldRef.current = target;
      setFieldLabel(describeField(target));
    };
    window.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("focusin", onFocusIn);
      sessionRef.current?.stop();
    };
  }, [scopeId]);

  // ...and a keyboard shortcut starts it, from wherever the cursor is, so the
  // pill is never the only way in either.
  //
  // Ramy, 13 Sep 2026: "if I can say stop dictation and it stops, why can't I
  // say start dictation and it starts?" Because hearing that phrase means the
  // microphone is already open. A wake word needs the browser recording
  // continuously -- in Chrome that audio goes to Google's servers -- and in a
  // room full of learners being observed, that is a recording nobody consented
  // to. Stopping is free because the microphone is already on by then. So the
  // symmetric answer is a key rather than a word.
  useEffect(() => {
    if (listening) return;
    const onKey = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "D" || e.key === "d"))) return;
      if (!document.getElementById(scopeId)?.contains(document.activeElement)) return;
      e.preventDefault();
      startRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, scopeId]);

  // Escape ends it, from wherever the cursor is. A tutor dictating during an
  // observation should never have to find the pill again to stop -- Ramy,
  // 13 Sep 2026. Capture phase so it fires before a menu swallows the key, and
  // only while listening, so Escape still closes menus the rest of the time.
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      sessionRef.current?.stop();
      sessionRef.current = null;
      setListening(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening]);

  const toggle = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
      setListening(false);
      return;
    }
    const field = fieldRef.current;
    if (!field || !field.isConnected) {
      setError("Click into a field first.");
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
  }, [scopeId]);

  startRef.current = toggle;

  const value = useMemo(
    () => ({ supported, listening, error, fieldLabel, toggle }),
    [supported, listening, error, fieldLabel, toggle]
  );
  return <DictationContext.Provider value={value}>{children}</DictationContext.Provider>;
}

const TEAL = "oklch(37.5% 0.058 195)";
const DESTRUCTIVE = "oklch(52% 0.19 32)";
const SHEET = "oklch(98.5% 0.006 90)";

/**
 * `band` sits on a document's dark identity band and takes THAT band's own
 * idle colours -- teal's tints on the garnet band read green-grey, so they are
 * never shared (design_handoff_tp_feedback_cycle, colour map). `bar` sits in
 * the sticky bottom bar and outlines in the screen's role hue. Both drive the
 * same recogniser.
 */
export function DictateButton({
  variant,
  fill,
  text,
  hue = TEAL,
}: {
  variant: "band" | "header" | "bar";
  /** Band variant: the idle fill, from BAND[role].dictateFill. */
  fill?: string;
  /** Band variant: the idle text colour, from BAND[role].dictateText. */
  text?: string;
  /** Bar variant: the screen's role hue. */
  hue?: string;
}) {
  const ctx = useContext(DictationContext);
  if (!ctx) return null;
  const { supported, listening, fieldLabel, toggle } = ctx;
  const onBand = variant !== "bar";

  const label = !supported
    ? "Not supported here"
    : listening
      ? "Listening — Esc or say \u201cstop dictation\u201d"
      : fieldLabel
        ? "Dictate"
        : "Click into a field first";
  const hint = listening ? null : fieldLabel ? "⌘⇧D" : null;

  const style: React.CSSProperties = listening
    ? { background: DESTRUCTIVE, borderColor: DESTRUCTIVE, color: SHEET }
    : onBand
      ? { background: fill ?? "oklch(86% 0.09 82)", borderColor: fill ?? "oklch(86% 0.09 82)", color: text ?? "oklch(30% 0.042 58)" }
      : { background: `color-mix(in oklab, ${hue} 10%, transparent)`, borderColor: hue, color: hue };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!supported}
      aria-pressed={listening}
      title={listening && fieldLabel ? `Dictating into ${fieldLabel}` : undefined}
      className="inline-flex flex-none items-center gap-2 whitespace-nowrap rounded-full border-2 font-bold disabled:opacity-60"
      style={{
        ...style,
        padding: onBand ? "8px 18px" : "7px 16px",
        fontSize: onBand ? 13.5 : 13,
        boxShadow: onBand ? "0 2px 10px oklch(23.5% 0.017 65 / 0.25)" : undefined,
      }}
    >
      <span aria-hidden>{listening ? "●" : "🎙"}</span>
      {label}
      {hint ? <span style={{ opacity: 0.6, fontWeight: 600 }}>{hint}</span> : null}
    </button>
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

/** Kept for the self-evaluation form, which wants one button and its own scope. */
export function DictateAnywhere({ scopeId }: { scopeId: string }) {
  return (
    <DictationScope scopeId={scopeId}>
      <InlineDictate />
    </DictationScope>
  );
}

function InlineDictate() {
  const ctx = useContext(DictationContext);
  if (!ctx?.supported) return null;
  const { listening, error, fieldLabel, toggle } = ctx;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
          listening ? "border-destructive bg-status-warning-bg text-destructive" : "border-border text-ink trainee-hover-fill"
        }`}
      >
        <span aria-hidden>{listening ? "●" : "🎙"}</span>
        {listening ? "Stop" : "Dictate"}
      </button>
      <p className="text-[11px] leading-tight text-muted">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : listening ? (
          `Listening — Esc, or say “stop dictation”`
        ) : fieldLabel ? (
          `Into ${fieldLabel}`
        ) : (
          "Click a box, then speak"
        )}
      </p>
    </div>
  );
}
