// Assessment criteria per written assignment, verbatim from each 2024
// brief's own cover sheet (captured directly from the Assignment
// Review.dc.html design reference, which itself lifted them "verbatim").
// Hardcoded canonical source, same pattern as celta-criteria.ts -- these
// are Cambridge's own standardised criteria, not something a centre edits,
// so they live in code rather than a DB table a centre could diverge on.
// Each criterion gets a stable `key` (the source text carries none) used
// to key assignments.first_criteria_marks / resubmission_criteria_marks,
// so marks survive even if the wording here is later corrected.
import type { AssignmentTypeValue } from "@/lib/assignment-templates/content";

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
};

export type CriteriaMarks = Record<string, boolean>;
