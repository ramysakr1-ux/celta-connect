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
  forms: "Forms and Documents",
  centre_documents: "Centre Documents",
  admissions: "Admissions",
  tp_points: "TP Points",
};

// Ramy, 28 Aug 2026: "it should be in the trainer view only, not in the
// trainee." Hard, category-level restriction, same mechanism
// TRAINER_ONLY_CATEGORIES already uses for admissions/centre_documents in
// resource-info.ts -- tp_points joins that set as a genuinely new addition.
// Ramy, 29 Aug 2026: "the coursebooks will not be trainee view, they are
// trainer view." Joins the set. Worth noting what a trainee loses: the
// section listed the course's own books with their access notes, which is
// arguably useful to them -- but which book a TP class uses reaches them
// through their TP materials anyway, and the shelf is really a staff
// planning tool.
// Ramy, 29 Aug 2026: "what exactly is teaching practice resources, and
// what is lesson planning resources? Why is this here? They get everything
// pushed to them -- they get the TP points with the scanned copies of the
// pages they are teaching."
//
// He is right, and so is the spec: for-claude-code-trainee-interface.md §5
// defines a five-item trainee rail (input sessions, coursebooks,
// multimedia, assignment briefs, forms) and neither of these was ever on
// it. Both are generic staff filing buckets from the trainer-side
// taxonomy -- a centre's lesson-plan pro-forma, a TP handout -- that I
// pulled into the trainee Hub when building the 15-category structure.
// That was my error, not a decision.
//
// Nothing is deleted: staff still see and file into both, and a document a
// trainee genuinely needs belongs in Forms and Documents, which is what
// that category is for.
export const HUB_STAFF_ONLY: HubCategoryKey[] = [
  "lesson_planning",
  "teaching_practice",
  "coursebooks",
  "centre_documents",
  "admissions",
  "tp_points",
];
