-- specs/build-spec.md §3 "Deferral" + CELTA Admin Handbook §6.9. The last
-- and largest of the four "leaving the course" cases (after Withdrawal,
-- Extension, first-half restart). Same two-sided shape as restart_transfers
-- (0070): source side snapshots everything now, well before any
-- destination course exists; destination side links once the candidate
-- actually joins one. Deferral carries much more than a restart, per
-- "everything freezes as it stands, complete or not" -- not just passed
-- assignments, but TPs taught, in-progress assignments, CELTA5 criteria,
-- and tutorial records too.
create table public.deferral_transfers (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id),
  source_trainee_id uuid not null references public.profiles(id),
  source_course_id uuid not null references public.courses(id),

  -- "full details of the reasons for the deferral and the arrangements for
  -- re-integration and course completion" (Handbook 6.9's Appian form).
  reasons text not null,
  reintegration_arrangements text,
  -- Handbook 6.9: "normally starting no later than six months after the
  -- end of the original course for full-time courses and 12 months for
  -- part-time" -- computed and stored (not recomputed live) since the
  -- source course's own dates could theoretically be edited later.
  reintegration_deadline date,

  -- "How many hours carry is the centre's judgement, not a calculation.
  -- Default the carried figure to the hours already assessed, let a tutor
  -- change it, require a note when they do."
  hours_carried numeric not null,
  hours_carried_overridden boolean not null default false,
  hours_carried_note text,

  -- Frozen snapshots -- see src/lib/supabase/types.ts for the exact JSONB
  -- shapes (DeferredAssignmentSnapshot / CarriedTpSnapshot /
  -- CarriedCelta5MatrixEntry / CarriedCelta5Record).
  carried_assignments jsonb not null default '[]',
  carried_tps jsonb not null default '[]',
  carried_celta5_matrix jsonb not null default '[]',
  carried_celta5_record jsonb,

  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),

  destination_trainee_id uuid references public.profiles(id),
  destination_course_id uuid references public.courses(id),
  -- "The new course should be in the same mode of delivery as the original
  -- course, unless otherwise agreed in writing by the candidate. If the
  -- mode of delivery is changed, centres will need to provide the
  -- candidate with familiarisation activities." Captured at link time, once
  -- the destination course's real delivery_mode is known.
  mode_change_agreed_at timestamptz,
  familiarisation_plan text,
  linked_at timestamptz,
  linked_by uuid references public.profiles(id)
);

create index deferral_transfers_center_id_idx on public.deferral_transfers (center_id);
create index deferral_transfers_source_trainee_id_idx on public.deferral_transfers (source_trainee_id);

alter table public.deferral_transfers enable row level security;

-- Same shape as restart_transfers (0070) -- select-only for trainer/admin
-- in the centre, writes go through the admin client from the server
-- actions on both sides.
create policy "deferral_transfers: trainer/admin read their centre's transfers"
on public.deferral_transfers for select
to authenticated
using ((public.is_trainer() or public.is_admin()) and center_id = public.current_center_id());
