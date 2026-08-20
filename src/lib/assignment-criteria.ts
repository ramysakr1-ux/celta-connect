// Assessment criteria per written assignment, verbatim from each 2024
// brief's own cover sheet (captured directly from the Assignment
// Review.dc.html design reference, which itself lifted them "verbatim").
//
// Confirmed with Ramy 2026-08-20: this is the "centre judgment" category
// (as opposed to the fixed assignment instructions/word counts) -- the
// grey area where centres and tutors reasonably differ -- so it's centre-
// editable now (migration 0177, centre_assignment_criteria), seeded from
// this exact list as the default. ASSIGNMENT_CRITERIA below stays as the
// fallback for a centre with no rows yet (shouldn't happen post-backfill,
// but a table read failing shouldn't blank the marking form) and as the
// seed source. Each criterion keeps a stable `key` (the source text
// carries none) used to key assignments.first_criteria_marks /
// resubmission_criteria_marks, which is also why a centre "removing" one
// deactivates the row rather than deleting it.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignmentTypeValue } from "@/lib/assignment-templates/content";
import type { Database } from "@/lib/supabase/types";

export interface AssignmentCriterion {
  key: string;
  text: string;
}

export const ASSIGNMENT_CRITERIA: Record<AssignmentTypeValue, AssignmentCriterion[]> = {
  "Focus on Learner": [
    {
      key: "learner_background",
      text: "Showing awareness of how a learner's background, previous learning experience and learning preferences affect learning.",
    },
    { key: "language_needs", text: "Identifying the learner's language/skills needs" },
    {
      key: "terminology",
      text: "Correctly using terminology relating to the description of language systems and language skills.",
    },
    {
      key: "materials",
      text: "Selecting appropriate material and/or resources (at least one of which must be from published materials) to aid the learners' language development.",
    },
    { key: "rationale", text: "Providing a rationale for using specific activities with the learners in mind." },
    {
      key: "referencing",
      text: "Finding, selecting and referencing information from one or more sources, within the body of the assignment.",
    },
    { key: "written_language", text: "Using written language that is clear, accurate and appropriate to the task" },
    { key: "word_count", text: "The assignment meets the 750-1,000-word count requirement" },
  ],
  LRT: [
    { key: "analysis", text: "Analyses language correctly" },
    { key: "terminology", text: "Uses terminology correctly" },
    {
      key: "reference_materials",
      text: "Shows evidence of having accessed appropriate reference materials, i.e. give the name of at least one book that you have used to research the area",
    },
    { key: "written_language", text: "Uses clear, accurate and appropriate language" },
    { key: "word_count", text: "The assignment meets the 750-1,000-word count requirement" },
  ],
  Skills: [
    {
      key: "skills_identification",
      text: "Identifying receptive/productive skills that could be practised in relation to the text",
    },
    { key: "terminology", text: "Correctly using terminology that relates to language skills and sub-skills" },
    { key: "task_design", text: "Designing tasks in relation to the text with a rationale" },
    {
      key: "background_reading",
      text: "Finding, selecting and showing evidence of background reading in the topic area i.e. at least one sourced quote in the body of the assignment.",
    },
    { key: "written_language", text: "Using written language that is clear, accurate and appropriate to the task" },
    { key: "word_count", text: "The assignment meets the 750-1,000-word count requirement" },
  ],
  LfC: [
    {
      key: "strengths_weaknesses",
      text: "Show (convincing) evidence of an ability to identify their own teaching strengths and weaknesses in the light of feedback from learners, teachers and tutors.",
    },
    {
      key: "impact_on_learners",
      text: "Show convincing understanding of how their strengths/weaknesses can affect the learners.",
    },
    { key: "improvement_ideas", text: "Identify ways of improving their weaknesses (one or two practical solutions)." },
    {
      key: "observation_reflection",
      text: "Show reflection on their observation of other teachers in relation to their weaknesses.",
    },
    {
      key: "post_celta_development",
      text: "Describe in a specific way how to develop ELT knowledge and skills beyond the course (professional development post-CELTA).",
    },
    { key: "written_language", text: "Able to write in clear, accurate and appropriate language." },
    {
      key: "word_count",
      text: "The assignment meets the 750-1,000-word count requirement and there is clear reference to the sources used.",
    },
  ],
  // Not a Cambridge criteria set -- this is a centre sanction
  // (build-spec.md "Assignment 5"), so there's no official rubric to lift
  // verbatim. Derived directly from the spec's own 4-section description,
  // one criterion per section plus the standard word-count check.
  "Plagiarism Reflection": [
    {
      key: "own_account",
      text: "Gives their own honest account of what happened and how it came about -- not an apology, an account.",
    },
    {
      key: "rule_identified",
      text: "Quotes the specific centre policy and Cambridge guidance clause breached, and explains why it applies here.",
    },
    {
      key: "professional_impact",
      text: "Explains what it would mean for a learner, a colleague, or the centre if a teacher's materials or claims were not their own.",
    },
    {
      key: "future_practice",
      text: "Describes specific, concrete changes to how they will work -- source-noting, AI use and declaration -- going forward.",
    },
    { key: "word_count", text: "The assignment meets the 750-1,000-word count requirement." },
  ],
};

export type CriteriaMarks = Record<string, boolean>;

/** Active criteria for one assignment type, at the viewer's own centre. */
export async function getAssignmentCriteria(
  supabase: SupabaseClient<Database>,
  centerId: string,
  assignmentType: AssignmentTypeValue
): Promise<AssignmentCriterion[]> {
  const { data } = await supabase
    .from("centre_assignment_criteria")
    .select("key, criterion_text")
    .eq("center_id", centerId)
    .eq("assignment_type", assignmentType)
    .eq("active", true)
    .order("sort_order");
  if (!data || data.length === 0) return ASSIGNMENT_CRITERIA[assignmentType] ?? [];
  return data.map((r) => ({ key: r.key, text: r.criterion_text }));
}

/** All five assignment types at once, for screens that show every type together. */
export async function getAllAssignmentCriteria(
  supabase: SupabaseClient<Database>,
  centerId: string
): Promise<Record<AssignmentTypeValue, AssignmentCriterion[]>> {
  const { data } = await supabase
    .from("centre_assignment_criteria")
    .select("assignment_type, key, criterion_text")
    .eq("center_id", centerId)
    .eq("active", true)
    .order("sort_order");

  const byType = new Map<AssignmentTypeValue, AssignmentCriterion[]>();
  for (const row of data ?? []) {
    const type = row.assignment_type as AssignmentTypeValue;
    const list = byType.get(type) ?? [];
    list.push({ key: row.key, text: row.criterion_text });
    byType.set(type, list);
  }

  const result = {} as Record<AssignmentTypeValue, AssignmentCriterion[]>;
  for (const type of Object.keys(ASSIGNMENT_CRITERIA) as AssignmentTypeValue[]) {
    result[type] = byType.get(type) ?? ASSIGNMENT_CRITERIA[type];
  }
  return result;
}
