// The speech engine behind every microphone in Connect, in one place.
//
// It used to live inside VoiceTextarea, which meant dictation only existed
// where someone had remembered to swap a <textarea> for that component --
// five boxes on the lesson plan had it, Anticipated Problems & Solutions and
// every cell of the procedure table did not. Ramy, 12 Sep 2026: "Why can't we
// have just one microphone... whichever box has the cursor, that's when it
// starts dictating."
//
// So the engine is separated from the button. VoiceTextarea still owns its own
// (used by assignments, self-evaluation, tutor feedback and the capture form),
// and DictateAnywhere drives any focused field with the same engine.

// Only one dictation session should be active across the whole app at a time --
// starting a new one stops whichever was previously listening.
let stopActiveRecognition: (() => void) | null = null;

export type DictationField = HTMLTextAreaElement | HTMLInputElement;

/** Fields worth dictating into: free text, not a checkbox, date or number. */
export function isDictationField(node: EventTarget | null): node is DictationField {
  if (node instanceof HTMLTextAreaElement) return !node.disabled && !node.readOnly;
  if (node instanceof HTMLInputElement) {
    const type = (node.type || "text").toLowerCase();
    return !node.disabled && !node.readOnly && ["text", "search", "url", "email", "tel"].includes(type);
  }
  return false;
}

// React tracks a node's last value on the node itself, and an assignment
// through `node.value = x` goes through React's own setter, which updates that
// tracker -- so the input event that follows is deduped as "nothing changed"
// and onChange never fires. Going through the prototype's setter leaves the
// tracker stale, which is exactly what makes React notice. Uncontrolled fields
// behave the same either way, so this is safe for every caller.
export function setFieldValue(field: DictationField, value: string): void {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

export function joinText(base: string, addition: string): string {
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

export function applyPunctuationCommands(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PUNCTUATION_COMMANDS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/[ \t]+([.,!?:;)])/g, "$1").replace(/[ \t]{2,}/g, " ");
}

export function dictationSupported(): boolean {
  return typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export interface DictationSession {
  /** Ends the session. Safe to call more than once. */
  stop: () => void;
}

/**
 * Dictates into `field`, appending to whatever is already there.
 * `resolveField` lets a caller re-read the target on every result, so a
 * control that follows focus keeps writing into the right box.
 */
export function startDictation({
  field,
  resolveField,
  onError,
  onEnd,
}: {
  field: DictationField;
  resolveField?: () => DictationField | null;
  onError: (message: string) => void;
  onEnd: () => void;
}): DictationSession | null {
  const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) return null;

  stopActiveRecognition?.();

  let userStopped = false;
  let baseValue = field.value;
  let finalTranscript = "";
  let lastField: DictationField = field;

  const recognition = new SpeechRecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  const stop = () => {
    userStopped = true;
    recognition.stop();
  };
  stopActiveRecognition = stop;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const target = resolveField?.() ?? lastField;
    if (!target) return;
    // Clicking into another box mid-session moves the dictation with the
    // cursor rather than pasting the new speech into the old box.
    if (target !== lastField) {
      lastField = target;
      baseValue = target.value;
      finalTranscript = "";
    }

    let finalChunk = "";
    let interimChunk = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      if (result.isFinal) finalChunk += transcript;
      else interimChunk += transcript;
    }
    if (finalChunk) {
      finalTranscript = applyPunctuationCommands(joinText(finalTranscript, finalChunk));
    }
    const committed = joinText(baseValue, finalTranscript);
    setFieldValue(target, joinText(committed, interimChunk));
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    onError(event.error === "not-allowed" ? "Microphone access denied." : "Dictation error. Try again.");
  };

  recognition.onend = () => {
    if (!userStopped) {
      try {
        recognition.start();
        return;
      } catch {
        // fall through to idle below
      }
    }
    if (stopActiveRecognition === stop) stopActiveRecognition = null;
    onEnd();
  };

  recognition.start();
  return { stop };
}
