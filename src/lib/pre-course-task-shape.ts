// The shape of one pre-course task -- what kind of worksheet it is, not
// what the candidate answered. Seeded per task in migration 0239, written
// by hand against the real UCLES 2018 question text.
//
// Deliberately a small closed set: every one of the 50 tasks fits one of
// these, and a shape the renderer doesn't recognise falls back to a plain
// text box rather than rendering nothing.
export type TaskShape =
  | { kind: "open" }
  // Numbered sub-questions, a box each -- Cambridge routinely packs two or
  // three separate questions into one "Task N".
  | { kind: "parts"; parts: string[] }
  // A list of items, each answered in one or more short boxes.
  | { kind: "rows_text"; rows: string[]; cols: string[] }
  // A list of items, each answered by picking one fixed option.
  | { kind: "rows_choice"; rows: string[]; options: string[] }
  // As above plus a text box, revealed by one specific choice. Only Task 7
  // ("decide which are correct, write a correct version of the ones that
  // aren't") needs this.
  | { kind: "rows_choice_text"; rows: string[]; options: string[]; text_when: string; text_label: string }
  // Matching: every item picks from the same shared list.
  | { kind: "rows_select"; rows: string[]; options: string[] }
  // Pick N from a list (Task 5's "which do learners rate in the top five?").
  | { kind: "checklist"; options: string[]; pick: number };

export function parseTaskShape(raw: unknown): TaskShape | null {
  if (!raw || typeof raw !== "object") return null;
  const shape = raw as { kind?: unknown };
  switch (shape.kind) {
    case "open":
    case "parts":
    case "rows_text":
    case "rows_choice":
    case "rows_choice_text":
    case "rows_select":
    case "checklist":
      return raw as TaskShape;
    default:
      return null;
  }
}

// A structured answer is a map keyed by row/part index. Values differ by
// shape: a string for text and select rows, {choice, text} for choice rows,
// and a string[] of picked options for a checklist.
export type StructuredAnswer = Record<string, string | string[] | { choice?: string; text?: string }>;

export function parseAnswer(raw: string): StructuredAnswer {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as StructuredAnswer) : {};
  } catch {
    // A task retyped from `open` to a structured shape after someone had
    // already answered it leaves plain prose in the column. Keep it under a
    // reserved key rather than throwing it away.
    return { _text: raw };
  }
}

// Whether a structured answer counts as answered at all -- progress, the
// per-section count and the roster column all key off this, so an empty
// shell written by autosave must never read as "done."
export function answerHasContent(value: StructuredAnswer): boolean {
  return Object.values(value).some((v) => {
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (v && typeof v === "object") return Boolean(v.choice) || Boolean(v.text?.trim());
    return false;
  });
}

// The single place that decides whether a stored response -- plain text or
// JSON -- counts as answered, so the page, the section count and the roster
// can't drift apart on it.
export function responseIsAnswered(raw: string | null | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  const t = raw.trim();
  if (!t.startsWith("{")) return true;
  return answerHasContent(parseAnswer(t));
}
