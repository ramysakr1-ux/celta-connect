-- Stage 2 tutorial booking sheet (for-claude-code-trainer-remaining-
-- screens.md §3a). "Same underlying mechanism as the existing Consultation
-- bookable band and the interview-availability slot model" turned out, on
-- inspection, not to be literally true: Consultation is just a timetable
-- tag with no booking table at all, and interview_slots (0081) claims via
-- a plain read-then-write with no regeneration logic. What IS reused: the
-- interview_slots shape (one row per bookable position, trainee_id null =
-- open, claim by updating trainee_id), tightened here to an atomic RLS
-- claim instead of read-then-write; and course_broadcasts' brand-new
-- anchor/duplication machinery (migration 0093) for "the one announcement."
create table public.stage2_tutorial_blocks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  timetable_event_id uuid not null references public.course_timetable_events(id) on delete cascade,
  -- Exactly one of these: a paired TP group's tutorial covers BOTH halves
  -- (Stage 2 is individual, not per-teaching-half), an unpaired subgroup's
  -- covers just itself.
  tp_group_id uuid references public.course_tp_groups(id) on delete cascade,
  subgroup_id uuid references public.course_subgroups(id) on delete cascade,
  slot_length_minutes integer not null default 15,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint stage2_tutorial_blocks_one_scope check (
    (tp_group_id is not null and subgroup_id is null) or (tp_group_id is null and subgroup_id is not null)
  )
);

create index stage2_tutorial_blocks_course_id_idx on public.stage2_tutorial_blocks(course_id);

create table public.stage2_tutorial_slots (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.stage2_tutorial_blocks(id) on delete cascade,
  position integer not null check (position >= 1),
  trainee_id uuid references public.profiles(id),
  booked_at timestamptz,
  unique (block_id, position)
);

create unique index stage2_tutorial_slots_one_per_trainee
  on public.stage2_tutorial_slots(block_id, trainee_id)
  where trainee_id is not null;

-- Announcements group-scoping -- null (both) = course-wide, the existing
-- behaviour for every row today. Mirrors the exact same one-of-two-or-
-- neither shape as stage2_tutorial_blocks' own scope pair above.
alter table public.course_broadcasts
  add column visible_to_tp_group_id uuid references public.course_tp_groups(id) on delete cascade,
  add column visible_to_subgroup_id uuid references public.course_subgroups(id) on delete cascade;

-- The existing "cohort reads their course's broadcasts" policy (0027) has
-- no group check at all -- adding the two columns above without tightening
-- this would let any RLS query leak a group-scoped announcement to the
-- whole cohort regardless of what any one call site filters for, since
-- Postgres OR's every applicable SELECT policy together. Trainers/admins
-- are unaffected -- they read via their own separate unrestricted "manage"
-- policy below, not this one.
drop policy "course_broadcasts: cohort reads their course's broadcasts" on public.course_broadcasts;

create policy "course_broadcasts: cohort reads their course's broadcasts"
on public.course_broadcasts for select
to authenticated
using (
  course_id = public.current_course_id()
  and (
    (visible_to_tp_group_id is null and visible_to_subgroup_id is null)
    or (visible_to_subgroup_id is not null and exists (
      select 1 from public.course_subgroup_members m
      where m.subgroup_id = course_broadcasts.visible_to_subgroup_id and m.trainee_id = auth.uid()
    ))
    or (visible_to_tp_group_id is not null and exists (
      select 1 from public.course_subgroup_members m
      join public.course_subgroups g on g.id = m.subgroup_id
      where g.tp_group_id = course_broadcasts.visible_to_tp_group_id and m.trainee_id = auth.uid()
    ))
  )
);

alter table public.stage2_tutorial_blocks enable row level security;
alter table public.stage2_tutorial_slots enable row level security;

-- ---------- stage2_tutorial_blocks ----------

create policy "stage2_tutorial_blocks: trainer manages blocks in their course"
on public.stage2_tutorial_blocks for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "stage2_tutorial_blocks: admin manages blocks in their center"
on public.stage2_tutorial_blocks for all
to authenticated
using (
  public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin() and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create policy "stage2_tutorial_blocks: trainee reads their own group's blocks"
on public.stage2_tutorial_blocks for select
to authenticated
using (
  (subgroup_id is not null and exists (
    select 1 from public.course_subgroup_members m
    where m.subgroup_id = stage2_tutorial_blocks.subgroup_id and m.trainee_id = auth.uid()
  ))
  or
  (tp_group_id is not null and exists (
    select 1 from public.course_subgroup_members m
    join public.course_subgroups g on g.id = m.subgroup_id
    where g.tp_group_id = stage2_tutorial_blocks.tp_group_id and m.trainee_id = auth.uid()
  ))
);

-- ---------- stage2_tutorial_slots ----------

create policy "stage2_tutorial_slots: trainer manages slots in their course"
on public.stage2_tutorial_slots for all
to authenticated
using (
  public.is_trainer() and exists (
    select 1 from public.stage2_tutorial_blocks b
    where b.id = stage2_tutorial_slots.block_id and b.course_id = public.current_course_id()
  )
)
with check (
  public.is_trainer() and exists (
    select 1 from public.stage2_tutorial_blocks b
    where b.id = stage2_tutorial_slots.block_id and b.course_id = public.current_course_id()
  )
);

create policy "stage2_tutorial_slots: admin manages slots in their center"
on public.stage2_tutorial_slots for all
to authenticated
using (
  public.is_admin() and exists (
    select 1 from public.stage2_tutorial_blocks b
    join public.courses c on c.id = b.course_id
    where b.id = stage2_tutorial_slots.block_id and c.center_id = public.current_center_id()
  )
)
with check (
  public.is_admin() and exists (
    select 1 from public.stage2_tutorial_blocks b
    join public.courses c on c.id = b.course_id
    where b.id = stage2_tutorial_slots.block_id and c.center_id = public.current_center_id()
  )
);

create policy "stage2_tutorial_slots: trainee reads slots in their own group"
on public.stage2_tutorial_slots for select
to authenticated
using (
  exists (
    select 1 from public.stage2_tutorial_blocks b
    where b.id = stage2_tutorial_slots.block_id
    and (
      (b.subgroup_id is not null and exists (
        select 1 from public.course_subgroup_members m where m.subgroup_id = b.subgroup_id and m.trainee_id = auth.uid()
      ))
      or
      (b.tp_group_id is not null and exists (
        select 1 from public.course_subgroup_members m
        join public.course_subgroups g on g.id = m.subgroup_id
        where g.tp_group_id = b.tp_group_id and m.trainee_id = auth.uid()
      ))
    )
  )
);

-- "Any member of the group can claim the next open position... release
-- their slot back to open." Never touches anyone else's row (USING's
-- trainee_id check), never claims FOR someone else (WITH CHECK). Two
-- trainees racing the same open row are serialized by ordinary Postgres
-- row locking on UPDATE -- the loser's USING re-check fails once the
-- winner's write commits, unlike interview_slots' plain read-then-write
-- claim (0081) which has a real gap between the two.
create policy "stage2_tutorial_slots: trainee books or releases their own slot"
on public.stage2_tutorial_slots for update
to authenticated
using (
  (trainee_id is null or trainee_id = auth.uid())
  and exists (
    select 1 from public.stage2_tutorial_blocks b
    where b.id = stage2_tutorial_slots.block_id
    and (
      (b.subgroup_id is not null and exists (
        select 1 from public.course_subgroup_members m where m.subgroup_id = b.subgroup_id and m.trainee_id = auth.uid()
      ))
      or
      (b.tp_group_id is not null and exists (
        select 1 from public.course_subgroup_members m
        join public.course_subgroups g on g.id = m.subgroup_id
        where g.tp_group_id = b.tp_group_id and m.trainee_id = auth.uid()
      ))
    )
  )
)
with check (trainee_id is null or trainee_id = auth.uid());

-- "If it turns out too short, the tutor can adjust the block length --
-- unbooked positions regenerate; anyone already booked keeps their
-- position." security invoker (not definer), same choice as
-- assign_tp_round (migration 0014) -- no masking/recursion problem here,
-- so the caller's own RLS grants (the trainer-manages-slots policy above)
-- apply directly and this can't be used to bypass anything.
create function public.set_stage2_slot_count(p_block_id uuid, p_slot_count integer)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.stage2_tutorial_slots
  where block_id = p_block_id and trainee_id is null and position > p_slot_count;

  insert into public.stage2_tutorial_slots (block_id, position)
  select p_block_id, gs
  from generate_series(1, p_slot_count) gs
  where not exists (
    select 1 from public.stage2_tutorial_slots s where s.block_id = p_block_id and s.position = gs
  );
end;
$$;
