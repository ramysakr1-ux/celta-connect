import type { ResourceCategory, ResourceType } from "@/lib/supabase/types";

export const RESOURCE_CATEGORY_ORDER: ResourceCategory[] = [
  "lesson_planning",
  "teaching_practice",
  "written_assignments",
  "cambridge_documentation",
  "reading_input",
];

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  lesson_planning: "Lesson Planning",
  teaching_practice: "Teaching Practice",
  written_assignments: "Written Assignments",
  cambridge_documentation: "Cambridge Documentation",
  reading_input: "Reading & Input",
};

export const RESOURCE_TYPE_ORDER: ResourceType[] = ["template", "form", "brief", "cambridge_doc", "reading", "video"];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  template: "Template",
  form: "Form",
  brief: "Brief",
  cambridge_doc: "Cambridge Doc",
  reading: "Reading",
  video: "Video",
};

export const RESOURCE_TYPE_ICON: Record<ResourceType, string> = {
  template: "📄",
  form: "📋",
  brief: "📝",
  cambridge_doc: "🎓",
  reading: "📖",
  video: "🎬",
};
