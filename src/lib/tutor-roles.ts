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
  teaching_practice_tutor: "Teaching Practice Tutor",
  input_session_tutor: "Input Session Tutor",
  external_assessor: "External Assessor",
};
