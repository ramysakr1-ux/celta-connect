// Pure constants shared between server (workspace.tsx) and client
// ("use client" sections.tsx) code -- split out from trainer-in-training.ts
// specifically because that file has `import "server-only"` (it also holds
// real DB-writing functions), which blocks client components from
// importing anything from it at all, even plain constants.

export const HEADLINE_MIN_PCT = 80;
export const MIN_DELIVERED_SESSIONS = 4;
export const TASK12_STAGE1_REQUIRED = 2;
export const CANDIDATES_TO_FOLLOW = 2;
export const TASK_RECORD_ITEM_COUNT = 16;
export const INPUT_ASYNC_MAX_PCT = 10;
export const SHADOW_DAYS_REQUIRED = 3;
export const TIT_MODES = ["f2f", "online"] as const;
export const TIT_MODE_LABEL: Record<(typeof TIT_MODES)[number], string> = { f2f: "Face-to-face", online: "Online" };

export const TIT_PRE_COURSE_TASKS: { key: string; label: string }[] = [
  { key: "tracking_own_development", label: "Tracking your own development" },
  { key: "syllabus_and_assessment_guidelines", label: "Syllabus & Assessment Guidelines" },
  { key: "administration_handbook", label: "Administration Handbook" },
  { key: "syllabus_and_course_timetable", label: "Syllabus & course timetable" },
  { key: "candidate_reading", label: "Candidate reading" },
  { key: "candidate_selection", label: "Candidate selection" },
  { key: "observing_interviews", label: "Observing interviews" },
  { key: "standards_of_assessment", label: "Standards of assessment" },
];
