-- TP7/TP8 "Syllabus Planning Grid": unlike TP1-6, the topic isn't
-- rotation-assigned from the TP Points Library -- the trainee self-selects
-- their own aim/material, visible to their whole subgroup at once (soft
-- warning on material clashes, computed at read time in the app -- see
-- migration 0015). This migration lets that self-selected topic flow
-- through the exact same downstream pipeline TP1-6 already uses (lesson
-- plan, LA sheet, materials, self-evaluation, feedback) rather than
-- inventing a second one, per the explicit product decision: "everything
-- else the same... the only difference is they choose for themselves what
-- they're going to teach."
--
-- Two changes to the existing TP-card tables:
-- 1. Their tp_number check constraints widen from 1-6 to 1-8. Looked up by
--    querying pg_constraint at migration time rather than assuming
--    Postgres's default auto-generated name, since these were all inline,
--    unnamed `check (...)` clauses in their original CREATE TABLE.
-- 2. plan_assignments.rotation_position_used becomes nullable -- it's
--    meaningless for a self-selected TP7/8 row (nothing rotated it in).
--
-- Deliberately NOT widened: tp_points / course_tp_schedule (migrations
-- 0013/0014) -- those are TP Points Library / coursebook-rotation concepts
-- that TP7/8 explicitly don't participate in.

-- Idempotent by construction, and by explicit name rather than a dynamic
-- pg_constraint lookup: confirmed live (via the actual constraint-violation
-- error this migration hit mid-development) that Postgres's default
-- auto-generated name for these inline, unnamed `check (...)` clauses is
-- exactly `<table>_<column>_check`. Dropping both that name and this
-- migration's own `_range_chk` name (in case of a previous partial run)
-- before adding the canonical constraint fresh means this is safe to run
-- from scratch any number of times, in any partially-applied state.
do $$
declare
  t text;
begin
  foreach t in array array['plan_assignments', 'tp_plans', 'tp_self_evaluations', 'tp_feedback', 'tp_lessons']
  loop
    execute format('alter table public.%I drop constraint if exists %I_tp_number_check', t, t);
    execute format('alter table public.%I drop constraint if exists %I_tp_number_range_chk', t, t);
    execute format('alter table public.%I add constraint %I_tp_number_range_chk check (tp_number between 1 and 8)', t, t);
  end loop;
end $$;

alter table public.plan_assignments alter column rotation_position_used drop not null;

-- ============================================================
-- save_syllabus_planning_entry -- the only way a trainee can create or
-- edit their own TP7/8 topic. SECURITY DEFINER because trainees have no
-- direct write access to plan_assignments (by design, migration 0014) --
-- this function is the single, narrow, validated door into it for TP7/8
-- only, mirroring the existing assign_tp_round/submit_assignment_round
-- pattern rather than opening a general trainee INSERT policy.
-- ============================================================

create or replace function public.save_syllabus_planning_entry(
  p_tp_number smallint,
  p_main_aim text,
  p_sub_aim text,
  p_material text
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

  select tp.submitted_at is not null into v_locked
  from public.tp_plans tp
  where tp.trainee_id = v_trainee_id and tp.tp_number = p_tp_number;

  if v_locked then
    raise exception 'This TP''s lesson plan is already submitted -- ask your trainer to reopen it before changing the topic.';
  end if;

  insert into public.syllabus_planning_entries (course_id, tp_number, trainee_id, main_aim, sub_aim, material)
  values (v_course_id, p_tp_number, v_trainee_id, btrim(p_main_aim), nullif(btrim(coalesce(p_sub_aim, '')), ''), btrim(p_material))
  on conflict (course_id, tp_number, trainee_id)
  do update set
    main_aim = excluded.main_aim,
    sub_aim = excluded.sub_aim,
    material = excluded.material,
    updated_at = now();

  insert into public.plan_assignments (
    course_id, trainee_id, tp_number, rotation_position_used,
    main_lesson_aim, sub_aim, materials_description, density_tier, assigned_by
  )
  values (
    v_course_id, v_trainee_id, p_tp_number, null,
    btrim(p_main_aim), nullif(btrim(coalesce(p_sub_aim, '')), ''), btrim(p_material), 'minimal', v_trainee_id
  )
  on conflict (trainee_id, tp_number)
  do update set
    main_lesson_aim = excluded.main_lesson_aim,
    sub_aim = excluded.sub_aim,
    materials_description = excluded.materials_description,
    updated_at = now();
end;
$$;

grant execute on function public.save_syllabus_planning_entry(smallint, text, text, text) to authenticated;

-- ============================================================
-- Read access for the shared grid itself. Trainees previously had zero
-- visibility into their own subgroup: course_subgroup_members' only trainee
-- policy is "read your own membership row" (migration 0014), and
-- syllabus_planning_entries' only trainee policy is "manage your own entry"
-- (migration 0015) -- neither lets a trainee see their groupmates, which
-- the whole point of a shared self-select grid requires. Uses a new
-- security-definer helper (same shape as current_course_id() etc., 0001)
-- rather than a same-table subquery in course_subgroup_members' own policy,
-- to avoid the self-recursion bug fixed in migration 0010.
-- ============================================================

create or replace function public.current_subgroup_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select subgroup_id from public.course_subgroup_members where trainee_id = auth.uid();
$$;

drop policy if exists "course_subgroup_members: trainee reads their own subgroup" on public.course_subgroup_members;
create policy "course_subgroup_members: trainee reads their own subgroup"
on public.course_subgroup_members for select
to authenticated
using (subgroup_id = public.current_subgroup_id());

drop policy if exists "profiles: trainee reads subgroup-mates' profiles" on public.profiles;
create policy "profiles: trainee reads subgroup-mates' profiles"
on public.profiles for select
to authenticated
using (
  id in (select trainee_id from public.course_subgroup_members where subgroup_id = public.current_subgroup_id())
);

drop policy if exists "syllabus_planning_entries: trainee reads subgroup's entries" on public.syllabus_planning_entries;
create policy "syllabus_planning_entries: trainee reads subgroup's entries"
on public.syllabus_planning_entries for select
to authenticated
using (
  trainee_id in (select trainee_id from public.course_subgroup_members where subgroup_id = public.current_subgroup_id())
);
