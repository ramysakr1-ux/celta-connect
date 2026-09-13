-- The tutor side of the five assignments: blind double marking, the overall
-- comment, and returning a submission unmarked.
--
-- design_handoff_tutor_assignments (v1), 13 Sep 2026. Three things the
-- current schema cannot hold:
--
--   1. An OVERALL comment per round. The candidate's document has a slot for
--      it under "Before you start" and the spec makes it required before a
--      decision can be released, but the marking action has only ever written
--      per-SECTION comments. `assignments.tutor_feedback` exists, is written
--      by the seed and read by the assignments list -- but nothing in the app
--      writes it, and it is one field for a row that has two rounds.
--
--   2. A BLIND second mark. Handbook June 2025 9.2.3: "It is recommended that
--      centres should try to include some blind double-marking to ensure
--      internal verification of standards. Blind double marking involves each
--      tutor marking original scripts independently before discussing and
--      agreeing results." Today a second marker can only countersign what the
--      first marker decided -- there is nowhere to put an independent set of
--      marks, nowhere for the agreed set, and one timestamp doing the work of
--      both tutors' initials.
--
--   3. Returning a submission UNMARKED -- a wrong file, a missing appendix, a
--      declaration problem. It goes back with a reason, spends no
--      resubmission, and leaves a footprint.
--
-- Also here: `in_double_marking_sample`, so the sample a centre PICKS is
-- distinguishable from the fails that enter it automatically. Until now
-- "in the sample" could only be read backwards from a second marker having
-- already signed, which cannot express "picked, not yet marked".
--
-- Re-runnable.

alter table public.assignments
  -- The overall comment, per round. Kept separate from tutor_feedback rather
  -- than reusing it: that column is a single free-text note with no round,
  -- and the assignments list still falls back to it for rows written before
  -- this migration.
  add column if not exists first_overall_comment text,
  add column if not exists resubmission_overall_comment text,

  -- Marks exist but have not been released to the candidate. The first
  -- marker can save a draft, hand over to a second marker, and settle,
  -- all while first_status stays 'submitted'. Release is the moment
  -- first_status/resubmission_status moves, as it always has been.
  add column if not exists first_marks_saved_at timestamptz,
  add column if not exists resubmission_marks_saved_at timestamptz,

  -- The blind second mark: the second tutor's own independent reading,
  -- recorded before either tutor can see the other's. `second_mark_round`
  -- says which round it belongs to.
  add column if not exists second_criteria_marks jsonb not null default '{}'::jsonb,
  add column if not exists second_overall_comment text,
  add column if not exists second_marks_recorded_at timestamptz,
  add column if not exists second_mark_round text,

  -- What the two tutors settled on, once both marks are visible. This is
  -- what the candidate receives and what the record carries.
  add column if not exists agreed_criteria_marks jsonb not null default '{}'::jsonb,

  -- "Assignments that have been double-marked should be initialled by both
  -- tutors" (9.2.3). Two initials, two timestamps -- second_marker_recorded_at
  -- stays as it is for every row written before this.
  add column if not exists first_initialled_at timestamptz,
  add column if not exists second_initialled_at timestamptz,

  -- Picked into the centre's double-marked sample. A fail-type outcome is in
  -- the sample whether or not this is set (9.2.3: "The sample checked should
  -- include any fail assignments") -- this flag is the deliberate pick.
  add column if not exists in_double_marking_sample boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assignments_second_mark_round_check'
  ) then
    alter table public.assignments
      add constraint assignments_second_mark_round_check
      check (second_mark_round is null or second_mark_round in ('first', 'resubmission'));
  end if;
end $$;

-- Returned unmarked: a log, not a flag. A submission can go back more than
-- once, and who sent it back and why is the record.
create table if not exists public.assignment_returns (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  round text not null check (round in ('first', 'resubmission')),
  returned_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists assignment_returns_assignment_idx
  on public.assignment_returns (assignment_id, created_at desc);

alter table public.assignment_returns enable row level security;

-- The candidate reads why their work came back; tutors on the course and
-- admins at the centre read and write. Same shape as
-- assignment_section_responses, which this sits beside.
drop policy if exists "assignment_returns: trainee reads their own" on public.assignment_returns;
create policy "assignment_returns: trainee reads their own"
on public.assignment_returns for select
to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_returns.assignment_id and a.trainee_id = (select auth.uid())
  )
);

drop policy if exists "assignment_returns: trainer manages in their course" on public.assignment_returns;
create policy "assignment_returns: trainer manages in their course"
on public.assignment_returns for all
to authenticated
using (
  public.is_trainer()
  and exists (
    select 1 from public.assignments a
    where a.id = assignment_returns.assignment_id and a.course_id = public.current_course_id()
  )
)
with check (
  public.is_trainer()
  and exists (
    select 1 from public.assignments a
    where a.id = assignment_returns.assignment_id and a.course_id = public.current_course_id()
  )
);

drop policy if exists "assignment_returns: admin manages in their centre" on public.assignment_returns;
create policy "assignment_returns: admin manages in their centre"
on public.assignment_returns for all
to authenticated
using (
  public.is_admin()
  and exists (
    select 1 from public.assignments a
    join public.courses c on c.id = a.course_id
    where a.id = assignment_returns.assignment_id and c.center_id = public.current_center_id()
  )
)
with check (
  public.is_admin()
  and exists (
    select 1 from public.assignments a
    join public.courses c on c.id = a.course_id
    where a.id = assignment_returns.assignment_id and c.center_id = public.current_center_id()
  )
);

notify pgrst, 'reload schema';

-- Proof it ran. "Success. No rows returned" on a DDL-only script looks
-- exactly like a script that ran nothing.
select
  to_regclass('public.assignment_returns') as assignment_returns_table,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'assignments'
      and column_name in (
        'first_overall_comment', 'resubmission_overall_comment',
        'first_marks_saved_at', 'resubmission_marks_saved_at',
        'second_criteria_marks', 'second_overall_comment',
        'second_marks_recorded_at', 'second_mark_round',
        'agreed_criteria_marks', 'first_initialled_at',
        'second_initialled_at', 'in_double_marking_sample'
      )) as new_assignment_columns_should_be_12;
