// The pack's contents, verbatim from Assessor Visit.dc.html.
//
// One source for both the screen and the PDF. Two copies would drift, and the
// failure would be silent and bad: a pack whose PDF lists documents the screen
// doesn't, or vice versa, is exactly the discrepancy an assessor would notice
// and a centre couldn't explain.
//
// Handbook wording, not paraphrase -- "Application files / Including rejected
// applicants" and "The previous assessor's report" are the pack's own terms
// (see for-claude-code-assessor-visit.md, "Exact terminology").

export const COHORT_DOCUMENTS = [
  "Grades report",
  "Course timetable",
  "Assignment titles",
  "Tutor list and roles",
  "Candidate descriptions",
  "Lesson plans for the day",
] as const;

export const CENTRE_DOCUMENTS: { name: string; meta: string }[] = [
  { name: "Centre authorisation certificate", meta: "Cambridge centre number on file" },
  { name: "Candidate agreement & policies", meta: "Attendance, plagiarism, complaints, resubmission" },
  { name: "Application files", meta: "Including rejected applicants" },
  { name: "Volunteer attendance registers", meta: "All classes taught on this course" },
  { name: "Double-marking record", meta: "Blind second marks, all assignments" },
  { name: "Sample end-of-course report", meta: "Format only — the real one follows the grade meeting" },
  { name: "The previous assessor's report", meta: "The centre's most recent visit" },
  { name: "Marking guidance", meta: "Centre's standardisation evidence, dated" },
];
