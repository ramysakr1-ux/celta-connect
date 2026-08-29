-- get_my_celta5_record() broke when stage3_required was renamed.
--
-- Migration 0250 renamed celta5_records.stage3_required to
-- stage3_tutorial_required, because the column gated the wrong thing. This
-- function declares its return columns explicitly and selects
-- r.stage3_required by name, so from that moment it failed with "column
-- r.stage3_required does not exist" -- and it is the ONLY way a trainee
-- reads their own record, since that view is masked server-side by this
-- RPC rather than by the page.
--
-- The visible symptom: a candidate opening their CELTA 5 and being told
-- "No CELTA 5 record found yet. Check with your trainer." while the record
-- sat in the table untouched. Ramy found it on the live app within minutes
-- of the rename -- "why doesn't Amara have a cell to five?"
--
-- Neither the typechecker nor the build can see inside a database
-- function, so nothing caught it. The lesson for the next rename: grep the
-- migrations for the old column name, not just the application code.
--
-- Dropped and recreated rather than replaced: changing a function's
-- declared return type is not a CREATE OR REPLACE.
drop function if exists public.get_my_celta5_record();

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
  stage3_tutorial_required boolean,
  stage3_tutorial_given boolean,
  stage3_hours_taught numeric,
  stage3_tutor_overall public.standard_rating,
  stage3_tutor_notes text,
  stage3_tutor_written_assignments_notes text,
  stage3_tutor_other_notes text,
  stage3_finalized_at timestamptz,
  final_recommended_grade text,
  final_teaching_grade text,
  final_assignments_grade text,
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
    case when r.trainer_signoff_final_at is not null then r.stage3_tutorial_required end,
    case when r.trainer_signoff_final_at is not null then r.stage3_tutorial_given end,
    case when r.trainer_signoff_final_at is not null then r.stage3_hours_taught end,
    case when r.trainer_signoff_final_at is not null then r.stage3_tutor_overall end,
    case when r.trainer_signoff_final_at is not null then r.stage3_tutor_notes end,
    case when r.trainer_signoff_final_at is not null then r.stage3_tutor_written_assignments_notes end,
    case when r.trainer_signoff_final_at is not null then r.stage3_tutor_other_notes end,
    case when r.trainer_signoff_final_at is not null then r.stage3_finalized_at end,
    null::text, -- final_recommended_grade -- never revealed to trainee
    null::text, -- final_teaching_grade -- never revealed to trainee
    null::text, -- final_assignments_grade -- never revealed to trainee
    null::text, -- overall_notes -- never revealed to trainee
    r.admin_access_granted_at,
    r.admin_access_level,
    r.trainer_signoff_final_at,
    r.trainee_signoff_final_at,
    r.updated_at
  from public.celta5_records r
  where r.trainee_id = auth.uid();
$$;

grant execute on function public.get_my_celta5_record() to authenticated;
