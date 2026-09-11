-- Per-group coursebook schedule, so two TP groups can teach two levels at once.
--
-- Ramy, 11 Sep 2026: a real two-level course runs two groups at two levels in
-- parallel -- Group A elementary while Group B is intermediate -- and they swap
-- at the midpoint, so every candidate teaches both levels (Handbook §9.1.2).
-- course_tp_schedule was unique(course_id, tp_number): one coursebook per round
-- for the WHOLE course, which cannot express that. assign_tp_round read it that
-- way too, so both groups drew the same level. This is the limitation that
-- stopped the demo from calling the real engine at all.
--
-- The schedule becomes per TP group. No rows exist anywhere (verified 11 Sep
-- 2026), so there is nothing to backfill; tp_group_id goes straight to NOT NULL.

alter table public.course_tp_schedule
  drop constraint course_tp_schedule_course_id_tp_number_key;

alter table public.course_tp_schedule
  add column tp_group_id uuid not null references public.course_tp_groups (id) on delete cascade;

alter table public.course_tp_schedule
  add constraint course_tp_schedule_group_tp_key unique (course_id, tp_group_id, tp_number);

create index if not exists course_tp_schedule_group_idx
  on public.course_tp_schedule (tp_group_id);

-- assign_tp_round, reading the subgroup's OWN group's schedule.
--
-- Everything else is unchanged from migration 0067: it skips withdrawn
-- trainees, never overwrites an existing plan, and hands each member the
-- library point at their rotation position (aim, aim_type and all).
create or replace function public.assign_tp_round(p_subgroup_id uuid, p_tp_number smallint)
returns void
language plpgsql
as $$
declare
  v_course_id uuid;
  v_tp_group_id uuid;
  v_tp_coursebook_id uuid;
  v_subgroup_size int;
  v_published_count int;
  v_position int;
  v_member record;
  v_tp_point record;
begin
  select course_id, tp_group_id into v_course_id, v_tp_group_id
  from public.course_subgroups where id = p_subgroup_id;
  if v_course_id is null then
    raise exception 'Subgroup not found';
  end if;
  if v_tp_group_id is null then
    raise exception 'Subgroup is not in a TP group -- pair it before assigning a round';
  end if;

  select tp_coursebook_id into v_tp_coursebook_id
  from public.course_tp_schedule
  where course_id = v_course_id and tp_group_id = v_tp_group_id and tp_number = p_tp_number;

  if v_tp_coursebook_id is null then
    raise exception 'No coursebook scheduled for TP% in this group', p_tp_number;
  end if;

  select count(*) into v_subgroup_size
  from public.course_subgroup_members where subgroup_id = p_subgroup_id;

  select count(*) into v_published_count
  from public.tp_points
  where tp_coursebook_id = v_tp_coursebook_id and tp_number = p_tp_number and status = 'published';

  if v_published_count < v_subgroup_size then
    raise exception 'Only % of % needed TP points are published for TP%',
      v_published_count, v_subgroup_size, p_tp_number;
  end if;

  for v_member in
    select * from public.course_subgroup_members where subgroup_id = p_subgroup_id
  loop
    continue when exists (
      select 1 from public.plan_assignments
      where trainee_id = v_member.trainee_id and tp_number = p_tp_number
    );
    continue when exists (
      select 1 from public.profiles
      where id = v_member.trainee_id and course_status <> 'active'
    );

    v_position := ((v_member.base_slot + (p_tp_number - 1)) % v_subgroup_size) + 1;

    select * into v_tp_point
    from public.tp_points
    where tp_coursebook_id = v_tp_coursebook_id
      and tp_number = p_tp_number and status = 'published'
    order by sequence_index
    offset (v_position - 1) limit 1;

    insert into public.plan_assignments (
      course_id, trainee_id, tp_number, tp_point_id, rotation_position_used,
      main_lesson_aim, sub_aim, short_title, materials_description,
      procedure, page_references, density_tier, aim_type, assigned_by
    ) values (
      v_course_id, v_member.trainee_id, p_tp_number, v_tp_point.id, v_position,
      v_tp_point.main_lesson_aim, v_tp_point.sub_aim, v_tp_point.short_title,
      v_tp_point.materials_description, v_tp_point.procedure, v_tp_point.page_references,
      v_tp_point.density_tier, v_tp_point.aim_type, auth.uid()
    );
  end loop;
end;
$$;
