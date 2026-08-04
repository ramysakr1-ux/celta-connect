-- TP1/2 ("scripted" tier) generate main_lesson_aim/sub_aim as a full
-- CELTA-style sentence by design -- TP3-6 already store a short
-- "Category: Topic" string instead, which reads perfectly as a card
-- title. This adds an equivalent short field for TP1/2 (nullable --
-- TP3-6 leave it null and the card falls back to main_lesson_aim, which
-- is already short for them) so the TP card can show a real short title
-- for every TP number, not just 3-6.

alter table public.tp_points add column short_title text;
alter table public.plan_assignments add column short_title text;

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
      procedure, page_references, density_tier, assigned_by
    ) values (
      v_course_id, v_member.trainee_id, p_tp_number, v_tp_point.id, v_position,
      v_tp_point.main_lesson_aim, v_tp_point.sub_aim, v_tp_point.short_title,
      v_tp_point.materials_description, v_tp_point.procedure, v_tp_point.page_references,
      v_tp_point.density_tier, auth.uid()
    );
  end loop;
end;
$$;
