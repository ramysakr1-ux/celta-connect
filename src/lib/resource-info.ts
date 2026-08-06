import { FileSpreadsheet, ClipboardCheck, FileText, Stamp, BookOpen, CirclePlay, type LucideIcon } from "lucide-react";
import type { ResourceCategory, ResourceType } from "@/lib/supabase/types";

// §5.2 order -- roughly the order they're used across a course, Admissions
// last since it's trainer/assessor-only and least frequently opened.
export const RESOURCE_CATEGORY_ORDER: ResourceCategory[] = [
  "lesson_planning",
  "teaching_practice",
  "written_assignments",
  "cambridge_documentation",
  "reading",
  "input_sessions",
  "filmed_observations",
  "admissions",
];

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  lesson_planning: "Lesson Planning",
  teaching_practice: "Teaching Practice",
  written_assignments: "Written Assignments",
  cambridge_documentation: "Cambridge Documentation",
  reading: "Reading",
  input_sessions: "Input Sessions",
  filmed_observations: "Filmed Observations",
  admissions: "Admissions",
};

// Admissions is a hard, category-level restriction -- never trainee-visible
// regardless of the per-item visible_to_trainee flag (unlike every other
// category, where that flag is the only gate). Assessor files / candidate
// files are staff material by definition, not an item-by-item choice.
export const TRAINER_ONLY_CATEGORIES: ResourceCategory[] = ["admissions"];

export const RESOURCE_TYPE_ORDER: ResourceType[] = ["template", "form", "brief", "cambridge_doc", "reading", "video"];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  template: "Template",
  form: "Form",
  brief: "Brief",
  cambridge_doc: "Cambridge Doc",
  reading: "Reading",
  video: "Video",
};

// Traced live off the Lovable reference 6 Aug 2026 -- real lucide-react
// icon components (file-spreadsheet/clipboard-check/file-text/stamp/
// book-open/circle-play), rendered size-4 at text-primary inside a size-9
// bg-surface-muted square. Emoji glyphs were a placeholder, not what the
// reference actually uses.
export const RESOURCE_TYPE_ICON: Record<ResourceType, LucideIcon> = {
  template: FileSpreadsheet,
  form: ClipboardCheck,
  brief: FileText,
  cambridge_doc: Stamp,
  reading: BookOpen,
  video: CirclePlay,
};
