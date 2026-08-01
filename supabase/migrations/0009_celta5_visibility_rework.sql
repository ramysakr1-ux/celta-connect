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

-- Drop first: CREATE OR REPLACE can't change a function's return
-- shape, and RETURNS TABLE(...) below is a different return shape
-- than the previous RETURNS public.celta5_records/SETOF version.
drop function if exists public.get_my_celta5_record();
drop function if exists public.get_my_celta5_matrix();

-- RETURNS TABLE with an explicit column list, rather than
-- RETURNS public.celta5_records, so this function's output shape is
-- self-contained and never has to positionally match the table's
-- physical column order again (which is what broke the first version
-- of this migration once admin_access_granted_at etc. were appended).
create function public.get_my_celta5_record()
returns table (
  id uuid,
  course_id uuid,
  trainee_id uuid,
  hours_attended numeric,
  stage1_tutorial_given boolean,
  stage1_hours_taught numeric,
  stage1_strengths text,
  stage1_action_plan text,
  stage1_completed_at timestamptz,
  stage2_tutorial_given boolean,
  stage2_hours_taught numeric,
  stage2_candidate_submitted_at timestamptz,
  stage2_candidate_overall public.standard_rating,
  stage2_candidate_notes text,
  stage2_candidate_written_assignments_notes text,
  stage2_candidate_other_notes text,
  stage2_tutor_overall public.standard_rating,
  stage2_tutor_notes text,
  stage2_tutor_written_assignments_notes text,
  stage2_tutor_other_notes text,
  stage2_completed_at timestamptz,
  trainee_signoff_stage2_at timestamptz,
  stage3_required boolean,
  stage3_tutorial_given boolean,
  stage3_hours_taught numeric,
  stage3_tutor_overall public.standard_rating,
  stage3_tutor_notes text,
  stage3_tutor_written_assignments_notes text,
  stage3_tutor_other_notes text,
  stage3_finalized_at timestamptz,
  final_recommended_grade text,
  overall_notes text,
  admin_access_granted_at timestamptz,
  admin_access_level text,
  trainer_signoff_final_at timestamptz,
  trainee_signoff_final_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id, r.course_id, r.trainee_id,
    case when r.stage2_completed_at is not null then r.hours_attended end,
    case when r.stage2_completed_at is not null then r.stage1_tutorial_given end,
    case when r.stage2_completed_at is not null then r.stage1_hours_taught end,
    case when r.stage2_completed_at is not null then r.stage1_strengths end,
    case when r.stage2_completed_at is not null then r.stage1_action_plan end,
    case when r.stage2_completed_at is not null then r.stage1_completed_at end,
    case when r.stage2_completed_at is not null then r.stage2_tutorial_given end,
    case when r.stage2_completed_at is not null then r.stage2_hours_taught end,
    r.stage2_candidate_submitted_at,
    r.stage2_candidate_overall,
    r.stage2_candidate_notes,
    r.stage2_candidate_written_assignments_notes,
    r.stage2_candidate_other_notes,
    case when r.stage2_completed_at is not null then r.stage2_tutor_overall end,
    case when r.stage2_completed_at is not null then r.stage2_tutor_notes end,
    case when r.stage2_completed_at is not null then r.stage2_tutor_written_assignments_notes end,
    case when r.stage2_completed_at is not null then r.stage2_tutor_other_notes end,
    r.stage2_completed_at,
    r.trainee_signoff_stage2_at,
    case when r.trainer_signoff_final_at is not null then r.stage3_required end,
    case when r.trainer_signoff_final_at is not null then r.stage3_tutorial_given end,
    case when r.trainer_signoff_final_at is not null then r.stage3_hours_taught end,
    case when r.trainer_signoff_final_at is not null then r.stage3_tutor_overall end,
    case when r.trainer_signoff_final_at is not null then r.stage3_tutor_notes end,
    case when r.trainer_signoff_final_at is not null then r.stage3_tutor_written_assignments_notes end,
    case when r.trainer_signoff_final_at is not null then r.stage3_tutor_other_notes end,
    case when r.trainer_signoff_final_at is not null then r.stage3_finalized_at end,
    case when r.trainer_signoff_final_at is not null then r.final_recommended_grade end,
    case when r.trainer_signoff_final_at is not null then r.overall_notes end,
    r.admin_access_granted_at,
    r.admin_access_level,
    r.trainer_signoff_final_at,
    r.trainee_signoff_final_at,
    r.updated_at
  from public.celta5_records r
  where r.trainee_id = auth.uid();
$$;

create function public.get_my_celta5_matrix()
returns table (
  id uuid,
  course_id uuid,
  trainee_id uuid,
  criteria_code text,
  candidate_status public.criteria_rating,
  tutor_status_stage2 public.criteria_rating,
  tutor_comments_stage2 text,
  tutor_status_stage3 public.criteria_rating,
  tutor_comments_stage3 text,
  updated_at timestamptz
)
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
