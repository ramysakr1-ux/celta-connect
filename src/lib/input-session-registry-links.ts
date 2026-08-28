// Ramy, 28 Aug 2026: the real timetable's input-session titles (criteria-
// mapped, deliberately designed, never renamed) and the 21 real interactive
// Connect Native sessions (src/app/input-sessions/registry.ts) are two
// separate things he built at different times -- not required to match by
// title. This is the one place they're allowed to touch: a short, manually
// confirmed list of real timetable session titles that genuinely are the
// same session as a registry slug, so that specific card can also link to
// the interactive page. Deliberately NOT a fuzzy/automatic string match --
// guessing wrong here would silently point a candidate at the wrong
// content. Only titles confirmed here get the link; everything else on the
// timetable renders as a plain card with no assumption either way.
export const TIMETABLE_TITLE_TO_INPUT_SESSION_SLUG: Record<string, string> = {
  "Lesson planning input": "lesson-planning",
  "Receptive skills": "receptive-skills",
  "Eliciting and concept checking": "eliciting-and-concept-checking",
  "Teaching vocabulary": "teaching-vocabulary",
  "PPP": "ppp",
  "Text-based teaching": "text-based-teaching",
  "Sounds": "sounds",
  "Language analysis 1": "language-analysis",
};
