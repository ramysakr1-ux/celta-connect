-- Reworks CELTA5 visibility/workflow per the actual center practice:
-- - Admin has zero default access; trainer grants it per-trainee.
-- - TP lessons can be tagged per-criterion (strength/action point), which
--   the trainer's Stage 2 form uses to suggest a starting rating -- never
--   auto-final, always trainer-reviewable/editable.
-- - The whole record (Stage 1 + 2) stays invisible to the trainee until
--   the trainer explicitly releases it (reusing stage2_completed_at as
--   that release gate); Stage 3 + final grade stay invisible until a new
--   explicit trainer final sign-off. Two matching trainee sign-off
--   actions record when the trainee has reviewed and confirmed each.

-- ============================================================
-- TP lesson criteria tags
-- ============================================================

create type public.criteria_tag_type as enum ('strength', 'action_point');

create table public.tp_lesson_criteria_tags (
  id uuid primary key default gen_random_uuid(),
  tp_lesson_id uuid not null references public.tp_lessons (id) on delete cascade,
  criteria_code text not null,
  tag_type public.criteria_tag_type not null,
  created_at timestamptz not null default now()
);

create index tp_lesson_criteria_tags_lesson_idx on public.tp_lesson_criteria_tags (tp_lesson_id);
create index tp_lesson_criteria_tags_code_idx on public.tp_lesson_criteria_tags (criteria_code);

alter table public.tp_lesson_criteria_tags enable row level security;

create policy "tp_lesson_criteria_tags: trainee can read tags on their own lessons"
on public.tp_lesson_criteria_tags for select
to authenticated
using (
  exists (
    select 1 from public.tp_lessons l
    where l.id = tp_lesson_criteria_tags.tp_lesson_id and l.trainee_id = auth.uid()
  )
);

create policy "tp_lesson_criteria_tags: trainer manages tags in their course"
on public.tp_lesson_criteria_tags for all
to authenticated
using (
  public.is_trainer() and exists (
    select 1 from public.tp_lessons l
    where l.id = tp_lesson_criteria_tags.tp_lesson_id and l.course_id = public.current_course_id()
  )
)
with check (
  public.is_trainer() and exists (
    select 1 from public.tp_lessons l
    where l.id = tp_lesson_criteria_tags.tp_lesson_id and l.course_id = public.current_course_id()
  )
);

create policy "tp_lesson_criteria_tags: admin manages tags in their center"
on public.tp_lesson_criteria_tags for all
to authenticated
using (
  public.is_admin() and exists (
    select 1 from public.tp_lessons l
    join public.courses c on c.id = l.course_id
    where l.id = tp_lesson_criteria_tags.tp_lesson_id and c.center_id = public.current_center_id()
  )
)
with check (
  public.is_admin() and exists (
    select 1 from public.tp_lessons l
    join public.courses c on c.id = l.course_id
    where l.id = tp_lesson_criteria_tags.tp_lesson_id and c.center_id = public.current_center_id()
  )
);

-- ============================================================
-- celta5_records: admin grant + sign-off columns
-- ============================================================

alter table public.celta5_records add column admin_access_granted_at timestamptz;
alter table public.celta5_records add column admin_access_granted_by uuid references public.profiles (id) on delete set null;
alter table public.celta5_records add column admin_access_level text check (admin_access_level in ('read', 'edit'));

alter table public.celta5_records add column trainee_signoff_stage2_at timestamptz;
alter table public.celta5_records add column trainer_signoff_final_at timestamptz;
alter table public.celta5_records add column trainee_signoff_final_at timestamptz;

-- ============================================================
-- Replace blanket admin access with grant-gated access.
-- ============================================================

drop policy if exists "celta5_matrix: admin manages matrix in their center" on public.celta5_matrix;
drop policy if exists "celta5_records: admin manages records in their center" on public.celta5_records;

create policy "celta5_records: admin can read granted records"
on public.celta5_records for select
to authenticated
using (
  public.is_admin()
  and admin_access_granted_at is not null
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create policy "celta5_records: admin can edit records granted at edit level"
on public.celta5_records for update
to authenticated
using (
  public.is_admin()
  and admin_access_granted_at is not null
  and admin_access_level = 'edit'
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and admin_access_granted_at is not null
  and admin_access_level = 'edit'
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create policy "celta5_matrix: admin can read granted matrix"
on public.celta5_matrix for select
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
  and exists (
    select 1 from public.celta5_records r
    where r.trainee_id = celta5_matrix.trainee_id and r.admin_access_granted_at is not null
  )
);

create policy "celta5_matrix: admin can edit matrix granted at edit level"
on public.celta5_matrix for update
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
  and exists (
    select 1 from public.celta5_records r
    where r.trainee_id = celta5_matrix.trainee_id
      and r.admin_access_granted_at is not null
      and r.admin_access_level = 'edit'
  )
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
  and exists (
    select 1 from public.celta5_records r
    where r.trainee_id = celta5_matrix.trainee_id
      and r.admin_access_granted_at is not null
      and r.admin_access_level = 'edit'
  )
);

-- ============================================================
-- Rework trainee visibility: stage1+2 gated behind the trainer's
-- release (stage2_completed_at), stage3+final gated behind a new
-- trainer_signoff_final_at.
-- ============================================================

-- The table's row type changed shape (new columns above), so
-- CREATE OR REPLACE can't be used here -- Postgres treats that as an
-- illegal return-type change (42P13) even though the type name is the
-- same. Drop and recreate instead.
drop function if exists public.get_my_celta5_record();
drop function if exists public.get_my_celta5_matrix();

create function public.get_my_celta5_record()
returns public.celta5_records
language sql
stable
security definer
set search_path = public
as $$
  select
    id, course_id, trainee_id,
    case when stage2_completed_at is not null then hours_attended end,
    case when stage2_completed_at is not null then stage1_tutorial_given end,
    case when stage2_completed_at is not null then stage1_hours_taught end,
    case when stage2_completed_at is not null then stage1_strengths end,
    case when stage2_completed_at is not null then stage1_action_plan end,
    case when stage2_completed_at is not null then stage1_completed_at end,
    case when stage2_completed_at is not null then stage2_tutorial_given end,
    case when stage2_completed_at is not null then stage2_hours_taught end,
    stage2_candidate_submitted_at,
    stage2_candidate_overall,
    stage2_candidate_notes,
    stage2_candidate_written_assignments_notes,
    stage2_candidate_other_notes,
    case when stage2_completed_at is not null then stage2_tutor_overall end,
    case when stage2_completed_at is not null then stage2_tutor_notes end,
    case when stage2_completed_at is not null then stage2_tutor_written_assignments_notes end,
    case when stage2_completed_at is not null then stage2_tutor_other_notes end,
    stage2_completed_at,
    trainee_signoff_stage2_at,
    case when trainer_signoff_final_at is not null then stage3_required end,
    case when trainer_signoff_final_at is not null then stage3_tutorial_given end,
    case when trainer_signoff_final_at is not null then stage3_hours_taught end,
    case when trainer_signoff_final_at is not null then stage3_tutor_overall end,
    case when trainer_signoff_final_at is not null then stage3_tutor_notes end,
    case when trainer_signoff_final_at is not null then stage3_tutor_written_assignments_notes end,
    case when trainer_signoff_final_at is not null then stage3_tutor_other_notes end,
    case when trainer_signoff_final_at is not null then stage3_finalized_at end,
    case when trainer_signoff_final_at is not null then final_recommended_grade end,
    case when trainer_signoff_final_at is not null then overall_notes end,
    admin_access_granted_at,
    admin_access_level,
    trainer_signoff_final_at,
    trainee_signoff_final_at,
    updated_at
  from public.celta5_records
  where trainee_id = auth.uid();
$$;

create function public.get_my_celta5_matrix()
returns setof public.celta5_matrix
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.course_id, m.trainee_id, m.criteria_code,
    m.candidate_status,
    case when r.stage2_completed_at is not null then m.tutor_status_stage2 end,
    case when r.stage2_completed_at is not null then m.tutor_comments_stage2 end,
    case when r.trainer_signoff_final_at is not null then m.tutor_status_stage3 end,
    case when r.trainer_signoff_final_at is not null then m.tutor_comments_stage3 end,
    m.updated_at
  from public.celta5_matrix m
  join public.celta5_records r on r.trainee_id = m.trainee_id
  where m.trainee_id = auth.uid();
$$;

-- ============================================================
-- Trainee sign-off actions (security definer: no direct UPDATE policy
-- exists for trainees on celta5_records, deliberately, so this is the
-- only way they can write to it -- and only these two timestamps).
-- ============================================================

create function public.trainee_sign_off_stage2()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.celta5_records
  set trainee_signoff_stage2_at = now()
  where trainee_id = auth.uid()
    and stage2_completed_at is not null
    and trainee_signoff_stage2_at is null;
end;
$$;

create function public.trainee_sign_off_final()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.celta5_records
  set trainee_signoff_final_at = now()
  where trainee_id = auth.uid()
    and trainer_signoff_final_at is not null
    and trainee_signoff_final_at is null;
end;
$$;
