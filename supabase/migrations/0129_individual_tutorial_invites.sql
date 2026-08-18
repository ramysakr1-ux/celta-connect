-- Stage 1 / Stage 3 tutorial booking (Ramy, 2026-08-17): "individualized
-- invites to stage one and to stage three tutorials... obviously not the
-- records, not the reports, but the tutorials." Stage 2 already has a real
-- booking mechanism (stage2_tutorial_blocks/slots, migration 0094) but it's
-- group-scoped -- a whole TP group or subgroup shares one block and claims
-- anonymous positions within it. Stage 1 and Stage 3 are structurally
-- different: one tutor inviting one specific candidate to one specific
-- time, not a pool several people compete to fill. So this is a much
-- simpler shape than Stage 2's block/slot pair -- one row per
-- (course, trainee, stage), directly owning a timetable tile, with a single
-- confirmed_at the trainee sets themselves.
--
-- Deliberately does NOT touch celta5_records.stage1_tutorial_given /
-- stage3_tutorial_given / stage1_completed_at / stage3_finalized_at -- the
-- existing record/report fields the trainer files after the fact. This
-- table is the scheduling/invite layer sitting alongside them, same
-- separation Stage 2's booking tables already have from those columns.
create table public.individual_tutorial_invites (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  stage text not null check (stage in ('stage1', 'stage3')),
  timetable_event_id uuid not null references public.course_timetable_events (id) on delete cascade,
  confirmed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  -- One active invite per candidate per stage per course. Rescheduling
  -- updates this same row (and its linked timetable event) rather than
  -- inserting a second one.
  unique (course_id, trainee_id, stage)
);

create index individual_tutorial_invites_course_id_idx on public.individual_tutorial_invites (course_id);

alter table public.individual_tutorial_invites enable row level security;

create policy "individual_tutorial_invites: trainer manages invites in their course"
on public.individual_tutorial_invites for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "individual_tutorial_invites: admin manages invites in their center"
on public.individual_tutorial_invites for all
to authenticated
using (public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id()))
with check (public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id()));

create policy "individual_tutorial_invites: trainee reads their own invite"
on public.individual_tutorial_invites for select
to authenticated
using (trainee_id = auth.uid());

-- Confirming is the only thing a trainee can do here -- the server action
-- only ever sends { confirmed_at }, same trust boundary as
-- stage2_tutorial_slots' own trainee-update policy (migration 0094).
create policy "individual_tutorial_invites: trainee confirms their own invite"
on public.individual_tutorial_invites for update
to authenticated
using (trainee_id = auth.uid())
with check (trainee_id = auth.uid());
