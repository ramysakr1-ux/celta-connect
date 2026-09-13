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
  // Added 1 Sep 2026, after Ramy found that most cards on a candidate's
  // Resources tab could not be opened: "some of them work, some of them
  // don't... I can't click on all of them." Only 8 of the 22 timetable
  // sessions were mapped, so 14 rendered inert by design and read as broken.
  //
  // These three are the ones I could confirm the same way the eight above
  // were -- title against registry title, not a fuzzy match:
  //   "Lesson planning" is the same session as "Lesson planning input",
  //   which was already mapped here under its longer name.
  //   "Providing models -- drilling" is the registry's "Drilling techniques".
  //   "Reflective Practice & Professional Development" is the registry's
  //   "Professional development & career advice".
  "Lesson planning": "lesson-planning",
  "Providing models -- drilling": "drilling-techniques",
  "Reflective Practice & Professional Development": "professional-development",
  // Confirmed by Ramy, 1 Sep 2026. The registry calls this one "2 of 2 --
  // pairs with Drilling Techniques", and the timetable carries that drilling
  // session two rows away, so the pair is the same pair.
  "Staging controlled practice": "language-practice",

  // --- The live course's own titles, read off a real candidate's Resources
  // tab on production, 1 Sep 2026 ---
  //
  // Everything above was matched against src/lib/timetable-skeleton.ts. That
  // was the wrong source: the skeleton seeds a course, but the titles on the
  // real timetable differ from it, so most of these lookups never fired and
  // 34 of 41 cards would not open. Ramy: "some of them work, some of them
  // don't... I can't click on all of them."
  //
  // With these, 20 of the 21 interactive sessions are reachable from the
  // timetable. The skeleton keys are kept above rather than deleted, since a
  // course seeded from it carries those titles instead.
  "Teaching literacy": "teaching-literacy",
  "Professional development and career advice": "professional-development",
  "Drilling technique": "drilling-techniques",
  "Language practice": "language-practice",
  "Guided discovery": "guided-discovery",
  "Functional language": "functional-language",
  "Teaching listening": "listening",
  "Connected speech": "connected-speech",
  "Stress and intonation": "stress-and-intonation",
  "MFP": "mfp",
  "Language analysis": "language-analysis",
  "Lesson framework": "lesson-framework",
  "Test-Teach-Test": "test-teach-test",

  // --- Ported 13 Sep 2026 (design_handoff_input_sessions_2 §4). Both are on
  // the live course on day 8, and both cards were dead because the design had
  // never been built. Titles read off the seeded timetable. ---
  "Error correction": "error-correction",
  "Giving feedback on tasks": "giving-feedback-on-tasks",

  // --- The last three, ported 13 Sep 2026. Classroom management has TWO
  // day-one slots: the core 60 minutes and the online extension, which is the
  // same session read with the Zoom contrast in front of you (the monitoring
  // simulation's own trainer note makes that comparison the point). Both
  // titles map to it. ---
  "Classroom management": "classroom-management",
  // Renamed on the timetable 13 Sep 2026 -- the second day-one slot is the
  // arrangements session, which is where criterion 5a is taught. The old
  // title stays mapped for any course still carrying it.
  "Classroom management / Zoom": "classroom-arrangements",
  "Classroom arrangements and material use": "classroom-arrangements",
  "Rapport and teacher talk": "rapport-and-teacher-talk",
  "Evaluating your plan": "evaluating-your-plan",
  "Teaching speaking": "teaching-speaking",
  "Productive skills -- writing": "teaching-writing",
  "Productive skills — writing": "teaching-writing",
};

/**
 * The lookup, tolerant of how a title is typed but never of what it says.
 *
 * The map above is exact-string on purpose -- a fuzzy match would silently
 * point a candidate at the wrong session. But a centre that types "Teaching
 * Listening" or "Teaching  listening" means the same session, and until
 * 13 Sep 2026 those dropped off the list and the card rendered inert.
 *
 * So: case, surrounding space, repeated spaces and the difference between a
 * hyphen, an en dash and a double hyphen are normalised on both sides. Every
 * other difference still misses, which is the point -- this recovers typing,
 * not meaning.
 */
export function inputSessionSlugForTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const direct = TIMETABLE_TITLE_TO_INPUT_SESSION_SLUG[title];
  if (direct) return direct;
  const normalise = (value: string) =>
    value
      .toLowerCase()
      .replace(/[\u2010-\u2015]/g, "-")
      .replace(/--+/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  const wanted = normalise(title);
  for (const [key, slug] of Object.entries(TIMETABLE_TITLE_TO_INPUT_SESSION_SLUG)) {
    if (normalise(key) === wanted) return slug;
  }
  return null;
}
