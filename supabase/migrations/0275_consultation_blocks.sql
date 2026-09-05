-- Consultation booking (design_handoff_tutorials_consultations, Ramy 5 Sep
-- 2026). Until now "Consultation" was only a timetable band -- the
-- syllabus's own name for one of the 120-hour categories -- with no
-- booking behind it; a candidate clicking the tile read "arranged with
-- your tutor". This is the booking, built on the Stage 2 engine
-- (migration 0094): a tutor places a block, Connect cuts it into
-- positions, candidates book the next open one, the sheet is the source
-- of truth. Three differences from Stage 2, all deliberate:
--   1. a block belongs to a TUTOR, not a TP group;
--   2. a candidate may book more than once across the course (no
--      one-per-trainee unique);
--   3. build-spec.md rule 15 applies at booking time -- any tutor before
--      an assignment's first submission, own tutor only after -- enforced
--      in the server action, which is the only path a candidate books
--      through.
-- Policies use the (select fn()) form so they are evaluated once per
-- query (migration 0272), and held_center_ids() for admins (0269).

create table public.consultation_blocks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  tutor_profile_id uuid not null references public.profiles(id) on delete cascade,
  timetable_event_id uuid not null references public.course_timetable_events(id) on delete cascade,
  slot_length_minutes integer not null default 15,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index consultation_blocks_course_id_idx on public.consultation_blocks(course_id);
create index consultation_blocks_tutor_idx on public.consultation_blocks(tutor_profile_id);

create table public.consultation_slots (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.consultation_blocks(id) on delete cascade,
  position integer not null check (position >= 1),
  trainee_id uuid references public.profiles(id),
  -- What the consultation is about, when the candidate says: the
  -- assignment the any-tutor / own-tutor rule was judged against.
  assignment_type text,
  booked_at timestamptz,
  unique (block_id, position)
);

alter table public.consultation_blocks enable row level security;
alter table public.consultation_slots enable row level security;

-- ---------- consultation_blocks ----------

create policy "consultation_blocks: trainer manages blocks in their course"
on public.consultation_blocks for all
to authenticated
using ((select public.is_trainer()) and course_id = (select public.current_course_id()))
with check ((select public.is_trainer()) and course_id = (select public.current_course_id()));

create policy "consultation_blocks: admin manages blocks in their centres"
on public.consultation_blocks for all
to authenticated
using (
  (select public.is_admin())
  and course_id in (select id from public.courses where center_id = any(public.held_center_ids()))
)
with check (
  (select public.is_admin())
  and course_id in (select id from public.courses where center_id = any(public.held_center_ids()))
);

-- Every candidate on the course sees every block -- which tutors have
-- opened time, and when. Whether they may BOOK a given one is the
-- action's rule, not a visibility question.
create policy "consultation_blocks: cohort reads their course's blocks"
on public.consultation_blocks for select
to authenticated
using (course_id = (select public.current_course_id()));

-- ---------- consultation_slots ----------

create policy "consultation_slots: trainer manages slots in their course"
on public.consultation_slots for all
to authenticated
using (
  (select public.is_trainer()) and exists (
    select 1 from public.consultation_blocks b
    where b.id = consultation_slots.block_id and b.course_id = (select public.current_course_id())
  )
)
with check (
  (select public.is_trainer()) and exists (
    select 1 from public.consultation_blocks b
    where b.id = consultation_slots.block_id and b.course_id = (select public.current_course_id())
  )
);

create policy "consultation_slots: admin manages slots in their centres"
on public.consultation_slots for all
to authenticated
using (
  (select public.is_admin()) and exists (
    select 1 from public.consultation_blocks b
    join public.courses c on c.id = b.course_id
    where b.id = consultation_slots.block_id and c.center_id = any(public.held_center_ids())
  )
)
with check (
  (select public.is_admin()) and exists (
    select 1 from public.consultation_blocks b
    join public.courses c on c.id = b.course_id
    where b.id = consultation_slots.block_id and c.center_id = any(public.held_center_ids())
  )
);

create policy "consultation_slots: cohort reads slots in their course"
on public.consultation_slots for select
to authenticated
using (
  exists (
    select 1 from public.consultation_blocks b
    where b.id = consultation_slots.block_id and b.course_id = (select public.current_course_id())
  )
);

-- Same atomic claim as Stage 2: a candidate may take an open row or give
-- back their own, never touch anyone else's, never claim for someone
-- else. Two candidates racing the same open row are serialised by row
-- locking; the loser's USING re-check fails once the winner commits.
create policy "consultation_slots: trainee books or releases their own slot"
on public.consultation_slots for update
to authenticated
using (
  (trainee_id is null or trainee_id = (select auth.uid()))
  and exists (
    select 1 from public.consultation_blocks b
    where b.id = consultation_slots.block_id and b.course_id = (select public.current_course_id())
  )
)
with check (trainee_id is null or trainee_id = (select auth.uid()));

-- Slot count follows the block's duration, never stored or edited
-- directly (same rule as Stage 2): lengthening regenerates open
-- positions, anyone already booked keeps theirs.
create function public.set_consultation_slot_count(p_block_id uuid, p_slot_count integer)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.consultation_slots
  where block_id = p_block_id and trainee_id is null and position > p_slot_count;

  insert into public.consultation_slots (block_id, position)
  select p_block_id, gs
  from generate_series(1, p_slot_count) gs
  where not exists (
    select 1 from public.consultation_slots s where s.block_id = p_block_id and s.position = gs
  );
end;
$$;

notify pgrst, 'reload schema';
