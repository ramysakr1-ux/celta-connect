-- Which tutor has a TP group, and from when.
--
-- Ramy, 5 Sep 2026: "the ACT is changing groups... how would Connect know
-- which group the tutor has? If we have four tutors, how would the rotation
-- be recognised?" Until now it could not: course_tp_groups.tutor_profile_id
-- was one field, set by hand on Rotation, with no dates and no history.
-- Everything scoped to an ACT (Today, Your day, alerts, announcements, the
-- Stage 2 and tutorial gates) reads that field, so when tutors swapped
-- groups mid-course (Handbook 3.7: TP split evenly between the two tutors)
-- someone had to remember to change it on the day.
--
-- Now the plan is written once: "Nadia from TP1, Marcus from TP4". A row
-- per (group, from TP n). The single field stays -- it is the seven
-- readers' contract -- but becomes DERIVED: sync_tp_group_tutors() sets it
-- to whichever assignment applies to the course's current TP number, on
-- every change to the plan (trigger) and hourly (pg_cron) as the calendar
-- moves. Shared access leaves a footprint: rows are attributed and
-- superseded, never deleted.

create table if not exists public.course_tp_group_tutors (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  tp_group_id uuid not null references public.course_tp_groups(id) on delete cascade,
  tutor_profile_id uuid not null references public.profiles(id) on delete cascade,
  -- Applies from this TP number onward, until a later row takes over.
  from_tp_number smallint not null check (from_tp_number between 1 and 8),
  set_by_profile_id uuid references public.profiles(id),
  set_at timestamptz not null default now(),
  note text,
  superseded_at timestamptz,
  superseded_by_profile_id uuid references public.profiles(id),
  constraint course_tp_group_tutors_supersede_attributed check ((superseded_at is null) = (superseded_by_profile_id is null))
);

comment on table public.course_tp_group_tutors is
  'The tutor plan for a TP group: who has it from which TP number. course_tp_groups.tutor_profile_id is derived from this by sync_tp_group_tutors(). Append-only: a row is superseded, never deleted, so the table is the log of who changed a group''s tutor and when.';

create unique index if not exists course_tp_group_tutors_one_live_per_tp
  on public.course_tp_group_tutors (tp_group_id, from_tp_number)
  where superseded_at is null;

create index if not exists course_tp_group_tutors_course_idx
  on public.course_tp_group_tutors (course_id)
  where superseded_at is null;

alter table public.course_tp_group_tutors enable row level security;

-- Same circle as course_tp_groups (0047): tutors on the course, admin in
-- the centre. The app writes through the admin client behind
-- requireCapabilityOrTrainer("courseAdmin.groups"), same as the field it
-- replaces.
drop policy if exists "course_tp_group_tutors: trainers on the course" on public.course_tp_group_tutors;
create policy "course_tp_group_tutors: trainers on the course"
on public.course_tp_group_tutors for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

drop policy if exists "course_tp_group_tutors: admin in their centre" on public.course_tp_group_tutors;
create policy "course_tp_group_tutors: admin in their centre"
on public.course_tp_group_tutors for all
to authenticated
using (public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id()))
with check (public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id()));

-- The course's current TP number: the highest TP whose timetable date has
-- arrived, in the centre's own zone (0 before TP1).
create or replace function public.current_tp_number(p_course_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(e.linked_tp_number), 0)::integer
  from public.course_timetable_events e
  join public.courses c on c.id = e.course_id
  join public.centers ctr on ctr.id = c.center_id
  where e.course_id = p_course_id
    and e.type = 'tp'
    and e.linked_tp_number is not null
    and e.event_date <= (now() at time zone coalesce(ctr.time_zone, 'Europe/Istanbul'))::date;
$$;

-- Derive course_tp_groups.tutor_profile_id from the plan. A group with no
-- live plan rows is left alone (a course set up before this migration and
-- never touched since keeps whatever the field says).
create or replace function public.sync_tp_group_tutors(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tp integer := greatest(public.current_tp_number(p_course_id), 1);
begin
  update public.course_tp_groups g
  set tutor_profile_id = planned.tutor_profile_id
  from (
    select distinct on (a.tp_group_id) a.tp_group_id, a.tutor_profile_id
    from public.course_tp_group_tutors a
    where a.course_id = p_course_id
      and a.superseded_at is null
      and a.from_tp_number <= v_tp
    order by a.tp_group_id, a.from_tp_number desc
  ) planned
  where g.id = planned.tp_group_id
    and g.tutor_profile_id is distinct from planned.tutor_profile_id;
end;
$$;

-- Any change to the plan re-derives the field at once.
create or replace function public.course_tp_group_tutors_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_tp_group_tutors(coalesce(new.course_id, old.course_id));
  return null;
end;
$$;

drop trigger if exists course_tp_group_tutors_sync on public.course_tp_group_tutors;
create trigger course_tp_group_tutors_sync
after insert or update or delete on public.course_tp_group_tutors
for each row execute function public.course_tp_group_tutors_sync_trigger();

-- Backfill: every group that already has a tutor gets a "from TP1" row, so
-- the plan starts from what the field says today. Idempotent.
insert into public.course_tp_group_tutors (course_id, tp_group_id, tutor_profile_id, from_tp_number, note)
select g.course_id, g.id, g.tutor_profile_id, 1, 'Carried over from the single tutor field, 5 Sep 2026'
from public.course_tp_groups g
where g.tutor_profile_id is not null
  and not exists (
    select 1 from public.course_tp_group_tutors a where a.tp_group_id = g.id
  );

-- Hourly: as the calendar reaches the next TP, hand the group over. Plain
-- SQL, no HTTP -- nothing outside the database is involved.
select cron.unschedule('tp-group-tutor-sync')
where exists (select 1 from cron.job where jobname = 'tp-group-tutor-sync');

select cron.schedule(
  'tp-group-tutor-sync',
  '7 * * * *',
  $$
  select public.sync_tp_group_tutors(c.id)
  from public.courses c
  where c.end_date >= current_date - 14;
  $$
);
