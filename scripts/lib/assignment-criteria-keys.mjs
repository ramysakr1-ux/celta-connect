// The criterion KEYS per assignment type, for seeding marking state.
//
// The criteria themselves -- text, order, and the fact that a centre can
// edit them -- live in src/lib/assignment-criteria.ts (ASSIGNMENT_CRITERIA,
// backfilled into centre_assignment_criteria by migration 0177). That file
// carries `import "server-only"`, so a seed script cannot import it; only
// the keys are mirrored here, never the wording.
//
// Written 13 Sep 2026, when an audit of live data found 35 assignments
// marked "approved" with an EMPTY first_criteria_marks -- every cover sheet
// for a passed assignment printed all its criteria as "Not met" beside the
// pass, because an unmarked criterion renders as not met. Administration
// Handbook June 2025 9.2.3: "To reach Pass standard, a candidate's work must
// meet all the assessment criteria specified for the written assignments."
export const CRITERIA_KEYS = {
  "Focus on Learner": [
    "learner_background",
    "language_needs",
    "terminology",
    "materials",
    "rationale",
    "referencing",
    "written_language",
    "word_count",
  ],
  LRT: ["analysis", "terminology", "reference_materials", "written_language", "word_count"],
  Skills: ["skills_identification", "terminology", "task_design", "background_reading", "written_language", "word_count"],
  LfC: [
    "strengths_weaknesses",
    "impact_on_learners",
    "improvement_ideas",
    "observation_reflection",
    "post_celta_development",
    "written_language",
    "word_count",
  ],
  "Plagiarism Reflection": ["own_account", "rule_identified", "professional_impact", "future_practice", "word_count"],
};

/** Every criterion met, except the keys named -- the shape a marking round stores. */
export function criteriaMarks(assignmentType, notMet = []) {
  const keys = CRITERIA_KEYS[assignmentType];
  if (!keys) return null;
  const marks = {};
  for (const key of keys) marks[key] = !notMet.includes(key);
  return marks;
}
