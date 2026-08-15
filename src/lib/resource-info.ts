import { FileSpreadsheet, ClipboardCheck, FileText, Stamp, BookOpen, CirclePlay, type LucideIcon } from "lucide-react";
import type { ResourceCategory, ResourceType } from "@/lib/supabase/types";

// §5.2 order -- roughly the order they're used across a course, Admissions
// last since it's trainer/assessor-only and least frequently opened.
export const RESOURCE_CATEGORY_ORDER: ResourceCategory[] = [
  "input_sessions",
  "lesson_planning",
  "teaching_practice",
  "written_assignments",
  "cambridge_documentation",
  "reading",
  "filmed_observations",
  "forms",
  "centre_documents",
  "admissions",
];

// for-claude-code-trainee-interface.md §5's own 5-item Sections rail --
// "Fewer sections than the trainer sees: TP points and centre documents are
// staff-only, not shown here." Deliberately a separate, shorter list from
// RESOURCE_CATEGORY_ORDER above (which stays the full trainer-side/staff
// taxonomy) rather than filtering that list at render time, since the
// trainee rail's fixed 5 items are a spec requirement, not a derived
// subset that should silently change if RESOURCE_CATEGORY_ORDER changes.
// Only 2 of the trainee Resources rail's 5 spec items are actually
// resources.category values ("Input sessions" and "Forms and documents",
// see the rail array in resources/page.tsx) -- "Coursebooks", "Multimedia"
// and "Assignment briefs" are the three existing dedicated tables/sections
// (CoursebooksSection / MultimediaSection / AssignmentBriefsSection,
// reading tp_coursebooks / tp_audio_library / assignment_templates
// respectively) already rendered inline on this page, same as the trainer
// hub does -- not resources.category rows at all.

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  lesson_planning: "Lesson Planning",
  teaching_practice: "Teaching Practice",
  written_assignments: "Written Assignments",
  cambridge_documentation: "Cambridge Documentation",
  reading: "Reading",
  input_sessions: "Input Sessions",
  filmed_observations: "Filmed Observations",
  admissions: "Admissions",
  centre_documents: "Centre Documents",
  forms: "Forms and Documents",
};

// Admissions and Centre Documents are hard, category-level restrictions --
// never trainee-visible regardless of the per-item visible_to_trainee flag
// (unlike every other category, where that flag is the only gate). Assessor
// files / candidate files / centre-administrative paperwork are staff
// material by definition, not an item-by-item choice.
// for-claude-code-trainee-interface.md §5: "centre documents are staff-only,
// not shown to trainees" -- was previously gated only by the per-item flag,
// a real hole (a staff member could leave visible_to_trainee on by mistake
// and a trainee would see it). The trainer resource-hub page's older copy
// ("mark specific items visible to trainees individually, e.g. the appeals
// procedure") described the pre-spec workaround for exactly this -- now
// superseded by the dedicated "forms" category below, which is where the
// appeals procedure actually belongs per §5's own panel-3 list.
export const TRAINER_ONLY_CATEGORIES: ResourceCategory[] = ["admissions", "centre_documents"];

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
