-- remaining-compliance.md "Changed by decision": candidates raise concerns
-- with the assessor in the meeting, not through a written channel -- the
-- assessor already has no chat access (build-spec.md §6). What candidates
-- get instead is a calming pre-visit announcement, which needs a real date
-- to be timed against.

alter table public.courses
  add column assessor_visit_date date;
