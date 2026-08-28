// The full Resource Hub category order -- Ramy, 28 Aug 2026: "we could just
// have more categories," confirmed one at a time over a long conversation,
// grounded against Resource Hub.dc.html (the design source) and the real
// schema. This is deliberately separate from RESOURCE_CATEGORY_ORDER in
// resource-info.ts, which stays the real `resources.category` DB enum (10
// values, needs a migration to change). Five of these 15 tiles wrap an
// existing separate table/feature instead of resources.category rows --
// Coursebooks (tp_coursebooks), TP7-8 Materials (tp_material_pool_items),
// Multimedia (tp_audio_library + tp_video_library), Pre-course Task
// (pre_course_task_sections/progress), TP Points (tp_points/tp_coursebooks)
// -- so adding them here needed zero schema changes, only new tiles in the
// Hub's own presentation layer.
export type HubCategoryKey =
  | "input_sessions"
  | "lesson_planning"
  | "teaching_practice"
  | "tp78_materials"
  | "multimedia"
  | "coursebooks"
  | "written_assignments"
  | "cambridge_documentation"
  | "reading"
  | "filmed_observations"
  | "precourse_task"
  | "forms"
  | "centre_documents"
  | "admissions"
  | "tp_points";

// Order roughly matches how a course actually uses each category, same
// reasoning RESOURCE_CATEGORY_ORDER's own comment already gives -- staff-only
// categories last since they're least frequently opened.
export const HUB_CATEGORY_ORDER: HubCategoryKey[] = [
  "input_sessions",
  "lesson_planning",
  "teaching_practice",
  "tp78_materials",
  "multimedia",
  "coursebooks",
  "written_assignments",
  "cambridge_documentation",
  "reading",
  "filmed_observations",
  "precourse_task",
  "forms",
  "centre_documents",
  "admissions",
  "tp_points",
];

export const HUB_CATEGORY_LABELS: Record<HubCategoryKey, string> = {
  input_sessions: "Input Sessions",
  lesson_planning: "Lesson Planning",
  teaching_practice: "Teaching Practice",
  tp78_materials: "TP7–8 Materials",
  multimedia: "Multimedia",
  coursebooks: "Coursebooks",
  written_assignments: "Written Assignments",
  cambridge_documentation: "Cambridge Documentation",
  reading: "Reading",
  filmed_observations: "Filmed Observations",
  precourse_task: "Pre-course Task",
  forms: "Forms and Documents",
  centre_documents: "Centre Documents",
  admissions: "Admissions",
  tp_points: "TP Points",
};

// Ramy, 28 Aug 2026: "it should be in the trainer view only, not in the
// trainee." Hard, category-level restriction, same mechanism
// TRAINER_ONLY_CATEGORIES already uses for admissions/centre_documents in
// resource-info.ts -- tp_points joins that set as a genuinely new addition.
export const HUB_STAFF_ONLY: HubCategoryKey[] = ["centre_documents", "admissions", "tp_points"];
