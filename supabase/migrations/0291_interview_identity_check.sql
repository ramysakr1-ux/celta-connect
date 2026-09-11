-- Handbook §7.2: "selection procedures must include authentication of the
-- candidate's identity (e.g., checking passport details)", and §7.3 points
-- the entry form's candidate names back at that same check. Until 12 Sep
-- 2026 Connect had nowhere to say it had happened: the interview record
-- carried the questions, the answers and two signatures, and the one thing
-- Cambridge names as mandatory was left to memory.
--
-- Recorded as a fact about the interview, not a copy of the document: the
-- moment it was checked and which kind of document was seen. No number, no
-- expiry, no scan -- §12.2 wants the assessor to see names only, and a
-- passport number in an applicant row is a liability the centre does not
-- need Connect to hold for it.
--
-- Re-runnable: both columns guard with IF NOT EXISTS, and the constraint
-- only attaches when it is not already there.
alter table public.interview_records
  add column if not exists identity_checked_at timestamptz,
  add column if not exists identity_document_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'interview_records_identity_document_type_check'
  ) then
    alter table public.interview_records
      add constraint interview_records_identity_document_type_check
      check (identity_document_type is null or identity_document_type in ('passport', 'national_id', 'driving_licence', 'other'));
  end if;
end $$;

comment on column public.interview_records.identity_checked_at is
  'Handbook 7.2 authentication of identity: when the interviewer saw the document. Null = not recorded.';
comment on column public.interview_records.identity_document_type is
  'Which kind of document was seen -- passport, national_id, driving_licence, other. Never the number.';
