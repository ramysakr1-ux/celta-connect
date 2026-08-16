// The tutor roles, and how they read on screen.
//
// Labels updated 2026-08-16 to Course Admin.dc.html's own ROLE_OPTIONS:
// "TP Tutor" rather than "Teaching Practice Tutor", "Input Tutor" rather than
// "Input Session Tutor", and "Assessor (if known)" rather than "External
// Assessor" -- the parenthetical is the design's, and it is doing work: an
// assessor often is not known when a course is being set up.
//
// The stored values are unchanged, so nothing already recorded breaks. Only
// what a person reads has moved.

export const TUTOR_ROLES = [
  "main_course_tutor",
  "assistant_course_tutor",
  "teaching_practice_tutor",
  "input_session_tutor",
  "external_assessor",
] as const;

export type TutorRole = (typeof TUTOR_ROLES)[number];

export const TUTOR_ROLE_LABELS: Record<TutorRole, string> = {
  main_course_tutor: "Main Course Tutor",
  assistant_course_tutor: "Assistant Course Tutor",
  teaching_practice_tutor: "TP Tutor",
  input_session_tutor: "Input Tutor",
  external_assessor: "Assessor (if known)",
};

/** Alias kept so the Course Admin screens can read singular. */
export const TUTOR_ROLE_LABEL = TUTOR_ROLE_LABELS;

/** The design's own default when inviting a tutor. */
export const DEFAULT_INVITE_TUTOR_ROLE: TutorRole = "main_course_tutor";

/** For rows that store a role but might hold something unexpected. */
export function tutorRoleLabel(value: string | null): string {
  if (!value) return "Role not set";
  return TUTOR_ROLE_LABELS[value as TutorRole] ?? value.replace(/_/g, " ");
}
