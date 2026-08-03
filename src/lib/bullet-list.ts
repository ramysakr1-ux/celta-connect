// Shared "auto-bullet" behaviour for free-text fields where trainees write in
// bullet points (lesson plan aims/procedure, language analysis prose fields).
// Operates directly on the textarea DOM node (same value-mutation +
// dispatchEvent("input") technique VoiceTextarea already uses for dictation),
// so it works unchanged whether the field is an uncontrolled defaultValue
// textarea (Main/Subsidiary/Personal Aims, Procedure) or a controlled
// value/onChange one (Language Analysis) -- no per-field state plumbing.
//
// Behaviour: focusing an empty field seeds the first bullet; Enter starts a
// new bulleted line; Backspace on a bullet with nothing typed after it yet
// removes that bullet (and its line) in one press, so a trainee who decides
// they don't want a list can always just delete their way out of it.

const BULLET = "• ";

function setValue(target: HTMLTextAreaElement, next: string, cursor: number) {
  target.value = next;
  target.dispatchEvent(new Event("input", { bubbles: true }));
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

export const bulletListProps = {
  onFocus: handleBulletFocus,
  onKeyDown: handleBulletKeyDown,
};
