-- Appian's required per-candidate field, which had nowhere to live.
--
-- Handbook 15.2, on the Assessor Report:
--
--   "In the case of all candidates, assessors must provide brief comments in
--    the 'Update on strengths and areas for development' section. This is a
--    required field in the form and must be completed for all candidates
--    including those being granted an extension or deferral or any withdrawn
--    candidates."
--
-- And 14.4 says where the content comes from: "The course tutor must contact
-- the assessor to confirm the final recommended grade for each candidate,
-- providing an update on strengths and areas for development for each
-- candidate and a rationale for each final grade."
--
-- So the tutor writes it and the assessor submits it. celta5_records had the
-- provisional side of the report (the four criteria lists) and the final
-- grade, but not this -- which meant the one field Appian will not accept a
-- report without was the one Connect could not hand over.
--
-- Note "areas for development", not "action points". The rest of the app says
-- action points and that stays; this column is named for the Appian field it
-- feeds, because that is what makes it findable. Ramy, 30 Aug 2026, on which
-- wording wins where they differ: "let's go with Appian."
--
-- Required for EVERY candidate, including extensions, deferrals and
-- withdrawals -- not only slashed ones. Nothing here enforces that; the
-- Grade form's release checklist reports it, the way it reports the rest.

alter table public.celta5_records
  add column if not exists final_update_notes text;

comment on column public.celta5_records.final_update_notes is
  'Appian "Update on strengths and areas for development" -- required for every candidate on the Assessor Report (Handbook 15.2), written by the course tutor at the end of the course (14.4) and submitted by the assessor. Distinct from overall_notes, which is 14.4''s rationale for the final grade.';
