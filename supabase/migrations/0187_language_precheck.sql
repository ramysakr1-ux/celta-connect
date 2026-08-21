-- connect-build-specs-5-gaps-2026-08-21.md item 1 / connect-decision-
-- language-precheck.md: a lightweight model call reading whether a
-- submission's register looks like genuine academic assignment prose,
-- run right after submission (src/lib/language-precheck.ts). Advisory
-- only -- null means "not flagged" (either the check found nothing worth
-- a look, or it never ran/failed, both of which mean the same thing to a
-- tutor: nothing to see here). Never blocks or changes submission status.
alter table public.assignments
  add column first_register_note text,
  add column resubmission_register_note text;
