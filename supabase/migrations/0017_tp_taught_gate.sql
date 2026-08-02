-- Sequential-reveal gate: a trainee should only ever see the TP they're
-- currently preparing, not the whole course's content up front. Rather than
-- tying this to a timetable (courses don't have one, and a scheduled date
-- only proves a TP was *planned*, not that it happened -- trainees get sick,
-- TPs get bumped), a trainee's TP{n} becomes eligible for assignment only
-- once a trainer has explicitly marked their TP{n-1} as taught. TP1 has no
-- prior gate.
--
-- taught_at is trainer-set only (no trainee update policy on plan_assignments
-- at all, per migration 0014) -- a trainee can't unlock their own next TP.

alter table public.plan_assignments add column taught_at timestamptz;

create or replace function public.assign_tp_round(p_subgroup_id uuid, p_tp_number smallint)
returns void
language plpgsql
as $$
declare
  v_course_id uuid;
  v_tp_coursebook_id uuid;
  v_subgroup_size int;
  v_published_count int;
  v_position int;
  v_member record;
  v_tp_point record;
begin
  select course_id into v_course_id from public.course_subgroups where id = p_subgroup_id;
  if v_course_id is null then
    raise exception 'Subgroup not found';
  end if;

  select tp_coursebook_id into v_tp_coursebook_id
  from public.course_tp_schedule
  where course_id = v_course_id and tp_number = p_tp_number;

  if v_tp_coursebook_id is null then
    raise exception 'No coursebook scheduled for TP%', p_tp_number;
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

    -- Skip (not error) members not yet cleared -- re-running "Assign TP{n}"
    -- later, after they're marked taught on TP{n-1}, picks them up then.
    continue when p_tp_number > 1 and not exists (
      select 1 from public.plan_assignments
      where trainee_id = v_member.trainee_id
        and tp_number = p_tp_number - 1
        and taught_at is not null
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
      main_lesson_aim, sub_aim, materials_description,
      procedure, page_references, density_tier, assigned_by
    ) values (
      v_course_id, v_member.trainee_id, p_tp_number, v_tp_point.id, v_position,
      v_tp_point.main_lesson_aim, v_tp_point.sub_aim, v_tp_point.materials_description,
      v_tp_point.procedure, v_tp_point.page_references,
      v_tp_point.density_tier, auth.uid()
    );
  end loop;
end;
$$;
