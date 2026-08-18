-- Grade Pipeline handoff, "Decided": "Stage 1 timing is fixed (always
-- after TP2, no override). Stage 2 and Stage 3 can be moved earlier by a
-- tutor, with a required reason, if there's a standing concern before the
-- standard checkpoint." No column for Stage 1 -- deliberately, it has no
-- override.
alter table public.celta5_records
  add column if not exists stage2_moved_earlier_at timestamptz,
  add column if not exists stage2_moved_earlier_reason text,
  add column if not exists stage2_moved_earlier_by uuid references public.profiles (id) on delete set null,
  add column if not exists stage3_moved_earlier_at timestamptz,
  add column if not exists stage3_moved_earlier_reason text,
  add column if not exists stage3_moved_earlier_by uuid references public.profiles (id) on delete set null;

comment on column public.celta5_records.stage2_moved_earlier_at is
  'MCT flagged a standing concern before the standard Stage 2 checkpoint. Not available once stage2_completed_at is set.';
comment on column public.celta5_records.stage3_moved_earlier_at is
  'MCT flagged a standing concern before the standard Stage 3 checkpoint. Not available once stage3_finalized_at is set.';
