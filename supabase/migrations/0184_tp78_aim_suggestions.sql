-- connect-spec-corrections-for-claude-code.md item 13: syllabus planning
-- suggestions for TP7/8. Two pieces:
--
-- 1. The MCT's per-slot constraint ("which main-aim types are allowed or
--    required for TP7 and TP8"). Modelled as one array field per slot --
--    a single-element array reads as "required", a multi-element array as
--    "allowed", null/empty as unconstrained -- rather than two separate
--    allowed/required fields the spec never actually asks for.
-- 2. The trainee's own aim_type on their self-selected TP7/8 topic, so the
--    suggestion engine (and the MCT's constraint) has something structured
--    to read -- syllabus_planning_entries only ever had free-text main_aim
--    before this (migration 0015), unlike TP1-6's tp_points.aim_type.

alter table public.courses
  add column tp7_allowed_aim_types text[],
  add column tp8_allowed_aim_types text[];

alter table public.courses
  add constraint courses_tp7_aim_types_valid check (
    tp7_allowed_aim_types is null
    or tp7_allowed_aim_types <@ array['grammar', 'lexis', 'function', 'reading', 'listening', 'speaking', 'writing']::text[]
  ),
  add constraint courses_tp8_aim_types_valid check (
    tp8_allowed_aim_types is null
    or tp8_allowed_aim_types <@ array['grammar', 'lexis', 'function', 'reading', 'listening', 'speaking', 'writing']::text[]
  );

alter table public.syllabus_planning_entries
  add column aim_type text check (
    aim_type is null or aim_type in ('grammar', 'lexis', 'function', 'reading', 'listening', 'speaking', 'writing')
  );

-- A new parameter changes the function's identity in Postgres (overload,
-- not replace) -- drop the old 4-arg signature first so the app has one
-- unambiguous version to call, not two.
drop function if exists public.save_syllabus_planning_entry(smallint, text, text, text);

-- Preserving migration 0025's full body -- only change is the new
-- p_aim_type parameter, its validation against the course's constraint for
-- this TP slot, and writing it through to both syllabus_planning_entries
-- (the source record) and plan_assignments (so the coverage matrix /
-- aim-type badge TP1-6 already get, TP7/8 now get too -- migration 0025
-- always left plan_assignments.aim_type null here).
create or replace function public.save_syllabus_planning_entry(
  p_tp_number smallint,
  p_main_aim text,
  p_sub_aim text,
  p_material text,
  p_aim_type text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trainee_id uuid := auth.uid();
  v_course_id uuid;
  v_role public.user_role;
  v_locked boolean;
  v_allowed text[];
begin
  select role, course_id into v_role, v_course_id from public.profiles where id = v_trainee_id;

  if v_role is distinct from 'trainee' or v_course_id is null then
    raise exception 'Only trainees can save a syllabus planning entry.';
  end if;
  if p_tp_number not in (7, 8) then
    raise exception 'Syllabus planning entries are only for TP7 and TP8.';
  end if;
  if p_main_aim is null or btrim(p_main_aim) = '' then
    raise exception 'Main aim is required.';
  end if;
  if p_material is null or btrim(p_material) = '' then
    raise exception 'Material is required.';
  end if;
  if p_aim_type is not null and p_aim_type not in ('grammar', 'lexis', 'function', 'reading', 'listening', 'speaking', 'writing') then
    raise exception 'Not a recognised aim type.';
  end if;

  select case when p_tp_number = 7 then tp7_allowed_aim_types else tp8_allowed_aim_types end
  into v_allowed
  from public.courses where id = v_course_id;

  if v_allowed is not null and array_length(v_allowed, 1) > 0 and (p_aim_type is null or not (p_aim_type = any(v_allowed))) then
    raise exception 'Your trainer has restricted TP% to specific aim types: %.', p_tp_number, array_to_string(v_allowed, ', ');
  end if;

  select tp.submitted_at is not null into v_locked
  from public.tp_plans tp
  where tp.trainee_id = v_trainee_id and tp.tp_number = p_tp_number;

  if v_locked then
    raise exception 'This TP''s lesson plan is already submitted -- ask your trainer to reopen it before changing the topic.';
  end if;

  insert into public.syllabus_planning_entries (course_id, tp_number, trainee_id, main_aim, sub_aim, material, aim_type)
  values (v_course_id, p_tp_number, v_trainee_id, btrim(p_main_aim), nullif(btrim(coalesce(p_sub_aim, '')), ''), btrim(p_material), p_aim_type)
  on conflict (course_id, tp_number, trainee_id)
  do update set
    main_aim = excluded.main_aim,
    sub_aim = excluded.sub_aim,
    material = excluded.material,
    aim_type = excluded.aim_type,
    updated_at = now();

  insert into public.plan_assignments (
    course_id, trainee_id, tp_number, rotation_position_used,
    main_lesson_aim, sub_aim, materials_description, density_tier, aim_type, assigned_by
  )
  values (
    v_course_id, v_trainee_id, p_tp_number, null,
    btrim(p_main_aim), nullif(btrim(coalesce(p_sub_aim, '')), ''), btrim(p_material), 'minimal', p_aim_type, v_trainee_id
  )
  on conflict (trainee_id, tp_number)
  do update set
    main_lesson_aim = excluded.main_lesson_aim,
    sub_aim = excluded.sub_aim,
    materials_description = excluded.materials_description,
    aim_type = excluded.aim_type,
    updated_at = now();
end;
$$;

grant execute on function public.save_syllabus_planning_entry(smallint, text, text, text, text) to authenticated;
