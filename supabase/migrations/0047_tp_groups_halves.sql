-- checkpoint 3 (Rotation.dc.html) -- the real "halves of three, alternating
-- TP days" mechanic, confirmed with Ramy: a TP group is capped at 6
-- trainees (could be fewer, never more), split into two "halves" that
-- alternate which real calendar TP day they teach on. Day-of-week isn't
-- stored here at all -- it's derived purely from the course's real
-- course_timetable_events (type='tp'), in chronological date order (see
-- distinctTpDates/halfTpDates in src/lib/rotation.ts). This keeps the
-- alternation always in sync with whatever's actually scheduled, and means
-- this migration only needs to add PAIRING, not a day-of-week setting.
--
-- Existing course_subgroups are completely unaffected -- the two new
-- columns default null, so every currently-seeded subgroup keeps rendering
-- through the old single-subgroup rotation board until an admin explicitly
-- pairs two of them here.

create table public.course_tp_groups (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index course_tp_groups_course_id_idx on public.course_tp_groups (course_id);

alter table public.course_subgroups
  add column tp_group_id uuid references public.course_tp_groups (id) on delete set null,
  add column half_order smallint check (half_order in (1, 2));

-- Both null (unpaired, the pre-existing shape) or both set -- never one
-- without the other.
alter table public.course_subgroups
  add constraint course_subgroups_half_pairing_consistent
  check ((tp_group_id is null) = (half_order is null));

-- At most one half_order=1 and one half_order=2 per tp_group -- structurally
-- caps a tp_group at exactly two halves. Multiple NULLs are fine under a
-- standard unique constraint, so unpaired subgroups are unaffected.
alter table public.course_subgroups
  add constraint course_subgroups_tp_group_half_order_unique unique (tp_group_id, half_order);

alter table public.course_tp_groups enable row level security;

create policy "course_tp_groups: trainer manages tp groups in their course"
on public.course_tp_groups for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "course_tp_groups: admin manages tp groups in their center"
on public.course_tp_groups for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

-- ============================================================
-- pair_subgroups: links two existing, currently-unpaired subgroups as the
-- two halves of a new TP group. Re-checks the combined-6 cap here too
-- (defense in depth alongside addSubgroupMember's own check) -- two
-- independently-unpaired subgroups can each grow up to 6 on their own, so
-- without this check pairing two already-large ones could silently create
-- a group above the real cap. security invoker (no `security definer`),
-- same as reorder_subgroup_members -- runs under the caller's own RLS.
-- ============================================================

create function public.pair_subgroups(
  p_course_id uuid,
  p_name text,
  p_first_subgroup_id uuid,
  p_second_subgroup_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_tp_group_id uuid;
  v_combined_count int;
begin
  if p_first_subgroup_id = p_second_subgroup_id then
    raise exception 'Choose two different subgroups';
  end if;

  if exists (
    select 1 from public.course_subgroups
    where id in (p_first_subgroup_id, p_second_subgroup_id)
      and (course_id != p_course_id or tp_group_id is not null)
  ) then
    raise exception 'Both subgroups must belong to this course and be unpaired';
  end if;

  select count(*) into v_combined_count
  from public.course_subgroup_members
  where subgroup_id in (p_first_subgroup_id, p_second_subgroup_id);

  if v_combined_count > 6 then
    raise exception 'Combined membership across both halves cannot exceed 6 (currently %)', v_combined_count;
  end if;

  insert into public.course_tp_groups (course_id, name) values (p_course_id, p_name)
  returning id into v_tp_group_id;

  update public.course_subgroups set tp_group_id = v_tp_group_id, half_order = 1
  where id = p_first_subgroup_id;

  update public.course_subgroups set tp_group_id = v_tp_group_id, half_order = 2
  where id = p_second_subgroup_id;

  return v_tp_group_id;
end;
$$;

grant execute on function public.pair_subgroups(uuid, text, uuid, uuid) to authenticated;
