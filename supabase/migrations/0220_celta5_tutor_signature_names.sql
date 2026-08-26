-- Ramy, 26 Aug 2026, building the real CELTA 5 replica export: "both
-- tutor and trainee sign for all three stages" -- the real Cambridge
-- Progress Record pages (Stage 1/2/3) each have a tutor signature line as
-- well as a candidate one, but celta5_records only ever captured a typed
-- signature name for the candidate side. The tutor side only had a bare
-- completion timestamp (stageN_completed_at / stage3_finalized_at) with no
-- "who" -- fine for gating the workflow, not enough to put a name on the
-- exported document. Those existing timestamps double as the tutor's
-- signed-date; only the name was missing.
alter table public.celta5_records
  add column stage1_tutor_signature_name text,
  add column stage2_tutor_signature_name text,
  add column stage3_tutor_signature_name text;

comment on column public.celta5_records.stage1_tutor_signature_name is
  'Typed signature of the tutor who completed the Stage 1 Progress Record, set the same moment stage1_completed_at is (see updateStage1). Reuses profiles.signature_name, same as every other typed signature in the app.';
comment on column public.celta5_records.stage2_tutor_signature_name is
  'Typed signature of the tutor who completed the Stage 2 Progress Record, set the same moment stage2_completed_at is (see updateStage2Overall).';
comment on column public.celta5_records.stage3_tutor_signature_name is
  'Typed signature of the tutor who completed the Stage 3 Progress Record, set the same moment stage3_finalized_at is (see updateStage3Overall).';
