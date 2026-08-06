-- Resource Hub category split, per Ramy's 5 Aug 2026 architecture-plan
-- update (§5.2): "Reading & Input" was doing three jobs in one heading
-- (course reading, recorded input sessions, filmed observations) -- split
-- into three real groups, plus a new "Admissions" group (Assessor files /
-- Candidate files, trainer+assessor only, never trainee-visible). Table is
-- empty (confirmed live, 0 rows) so this is a straight constraint swap,
-- no data to migrate.
alter table public.resources drop constraint resources_category_check;
alter table public.resources add constraint resources_category_check check (
  category in (
    'lesson_planning', 'teaching_practice', 'written_assignments', 'cambridge_documentation',
    'reading', 'input_sessions', 'filmed_observations', 'admissions'
  )
);
