-- for-claude-code-trainee-interface.md §5's "Forms and documents" panel --
-- blank PDFs of every built-in form (lesson plan template, self-evaluation
-- form, syllabus, appeals procedure) for when the platform is down or paper
-- is preferred. No existing resources.category fits this (it's neither
-- centre_documents -- staff-only per the same spec -- nor any of the
-- teaching-content categories); reuses the existing resources
-- table/upload/visibility machinery rather than a new table, same pattern
-- as centre_documents itself (migration 0075).

alter table public.resources drop constraint resources_category_check;
alter table public.resources add constraint resources_category_check check (
  category in (
    'lesson_planning', 'teaching_practice', 'written_assignments', 'cambridge_documentation',
    'reading', 'input_sessions', 'filmed_observations', 'admissions', 'centre_documents', 'forms'
  )
);
