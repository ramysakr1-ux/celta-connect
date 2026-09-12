import { setFieldValue } from "@/lib/dictation";

// Shared "auto-bullet" behaviour for free-text fields where trainees write in
// bullet points (lesson plan aims/procedure, language analysis prose fields).
// Operates directly on the textarea DOM node, so it needs no per-field state
// plumbing and works on uncontrolled and controlled fields alike.
//
// It writes through setFieldValue (the PROTOTYPE's value setter), not a plain
// `target.value = next`. React keeps its own tracker on the node, and a plain
// assignment updates that tracker too -- so the input event that follows is
// deduped as "nothing changed" and a controlled field's onChange never fires.
// design_handoff_trainee_lesson_plan §8 is explicit about this, and the
// redesigned procedure table is controlled where the old aims fields were not.
//
// Behaviour: focusing an empty field seeds the first bullet; Enter starts a
// new bulleted line; Backspace on a bullet with nothing typed after it yet
// removes that bullet (and its line) in one press, so a trainee who decides
// they don't want a list can always just delete their way out of it.

const BULLET = "• ";

function setValue(target: HTMLTextAreaElement, next: string, cursor: number) {
  setFieldValue(target, next);
  requestAnimationFrame(() => target.setSelectionRange(cursor, cursor));
}

export function handleBulletFocus(e: React.FocusEvent<HTMLTextAreaElement>) {
  const target = e.currentTarget;
  if (target.value !== "") return;
  setValue(target, BULLET, BULLET.length);
}

export function handleBulletKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  const target = e.currentTarget;
  const { selectionStart, selectionEnd, value: current } = target;
  if (selectionStart === null || selectionEnd === null) return;

  if (e.key === "Enter") {
    e.preventDefault();
    const next = current.slice(0, selectionStart) + "\n" + BULLET + current.slice(selectionEnd);
    setValue(target, next, selectionStart + 1 + BULLET.length);
    return;
  }

  if (e.key === "Backspace" && selectionStart === selectionEnd) {
    const lineStart = current.lastIndexOf("\n", selectionStart - 1) + 1;
    const linePrefix = current.slice(lineStart, selectionStart);
    if (linePrefix === BULLET) {
      e.preventDefault();
      const removeFrom = lineStart > 0 ? lineStart - 1 : lineStart;
      const next = current.slice(0, removeFrom) + current.slice(selectionStart);
      setValue(target, next, removeFrom);
    }
  }
}

// §8: "blurring a field holding only a bare bullet clears it" -- otherwise
// tabbing through the plan leaves a trail of lone bullets in boxes nobody
// wrote in, and an empty-looking field saves as "•".
export function handleBulletBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
  const target = e.currentTarget;
  if (target.value.trim() === "•" || target.value.trim() === BULLET.trim()) {
    setFieldValue(target, "");
  }
}

export const bulletListProps = {
  onFocus: handleBulletFocus,
  onKeyDown: handleBulletKeyDown,
  onBlur: handleBulletBlur,
};
