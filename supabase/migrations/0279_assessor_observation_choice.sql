-- Which candidates the centre puts to the assessor for observation, and why.
--
-- Connect recommends: the pool is whoever teaches on the visit day, ranked
-- in danger of failing first (the only tier Administration Handbook 14.2 /
-- 15.1 actually name), then by grade. The MCT can replace that pick, and
-- Ramy's standing rule applies -- anything the system decides must be
-- overridable, and the override must be manual, attributed and reasoned,
-- with the reason constrained by the database rather than by the form.
--
-- Append-only, because more than one person can act on a course's assessor
-- arrangements and "shared access leaves a footprint": every choice is a new
-- row, nothing is updated or deleted, and the current choice is simply the
-- newest one. That gives the visit a history rather than a final answer.
--
-- Advisory by design. This does NOT touch profiles.selected_for_assessor_visit
-- and does not narrow what the assessor's own page shows -- Handbook 15.1
-- gives the selection to the assessor "in consultation with the centre", so
-- the centre proposes and never decides.

create table if not exists public.assessor_observation_choices (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,

  -- Who the centre is putting forward to be observed teaching. Two, per
  -- Handbook 14.2 -- but not constrained to two here: a course can have one
  -- candidate teaching on the day, and a rule that refuses to record reality
  -- is worse than one that records it.
  trainee_ids uuid[] not null check (cardinality(trainee_ids) between 1 and 8),

  -- 'connect' when the MCT accepted the recommendation unchanged,
  -- 'centre' when they chose different candidates.
  source text not null check (source in ('connect', 'centre')),

  -- Required when the MCT overrode the recommendation, and meaningless when
  -- they accepted it. Constrained here so a future form cannot skip it.
  reason text check (reason is null or length(btrim(reason)) >= 3),

  -- What Connect had suggested at the time, so the record still makes sense
  -- after grades move and the recommendation would compute differently.
  recommended_ids uuid[] not null default '{}',

  chosen_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),

  constraint override_needs_a_reason
    check (source = 'connect' or (reason is not null and length(btrim(reason)) >= 3))
);

create index if not exists assessor_observation_choices_course_idx
  on public.assessor_observation_choices (course_id, created_at desc);

alter table public.assessor_observation_choices enable row level security;

-- Same circle as the rest of the assessor tab: anyone holding the centre the
-- course belongs to. held_center_ids() is used bare, the house form set by
-- migration 0269 -- it returns an array, so the (select ...) InitPlan wrapper
-- 0272 applied to the scalar helpers does not apply to it. auth.uid() does
-- take the wrapper.
create policy assessor_observation_choices_read
  on public.assessor_observation_choices for select
  using (
    exists (
      select 1 from public.courses c
      where c.id = assessor_observation_choices.course_id
        and c.center_id = any (public.held_center_ids())
    )
  );

-- Insert only. No update policy and no delete policy on purpose: the history
-- is the point, and a corrected choice is a new row.
create policy assessor_observation_choices_insert
  on public.assessor_observation_choices for insert
  with check (
    chosen_by = (select auth.uid())
    and exists (
      select 1 from public.courses c
      where c.id = assessor_observation_choices.course_id
        and c.center_id = any (public.held_center_ids())
    )
  );

notify pgrst, 'reload schema';
