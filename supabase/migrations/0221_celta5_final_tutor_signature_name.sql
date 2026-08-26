-- Same gap as migration 0220, one page later: the final-day declaration's
-- "Accepted by Tutor" line (celta5-replica page 27) has a candidate
-- signature column (final_candidate_signature_name) but the tutor side --
-- set via finalizeRecord -- was only ever a bare trainer_signoff_final_at
-- timestamp, no name.
alter table public.celta5_records
  add column final_tutor_signature_name text;

comment on column public.celta5_records.final_tutor_signature_name is
  'Typed signature of the tutor who finalized the record ("Accepted by Tutor" on the real CELTA 5), set the same moment trainer_signoff_final_at is (see finalizeRecord).';
