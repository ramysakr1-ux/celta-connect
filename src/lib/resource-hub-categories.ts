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
  lesson_planning: "Lesson Planning — samples",
  teaching_practice: "Teaching Practice — samples",
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
// Ramy, 29 Aug 2026: coursebooks and TP points are trainer-side, and
// centre documents and admissions always were.
//
// Lesson Planning and Teaching Practice were briefly staff-only too --
// nobody could say what belonged in them, and a trainee does not browse
// for TP material, it reaches them through their own TP screens. Then he
// asked the question that resolved it: "do we have samples for the
// trainees? Like a sample lesson plan, a sample LA sheet." We do not --
// nothing in the app or the schema -- and that is what these two shelves
// are for. His own Resource Hub.dc.html even listed "Board plan examples
// -- six worked board plans from previous cohorts" under Lesson Planning,
// designed and never built.
//
// So they are trainee-visible, and labelled as sample shelves rather than
// generic filing buckets. Empty until real samples are added: a worked
// language analysis sheet is pedagogy, not copy, and inventing one would
// mean teaching candidates something plausible and possibly wrong.
export const HUB_STAFF_ONLY: HubCategoryKey[] = [
  "coursebooks",
  "centre_documents",
  "admissions",
  "tp_points",
];
