-- Explicit correction from Ramy: trainees must NEVER see the real final
-- grade in-app, not even once the trainer finalizes the record at course
-- end. The real grade needs assessor approval first (and even that could
-- theoretically be overturned by Cambridge); what a trainee eventually
-- receives is a separate, not-yet-designed "provisional grade report"
-- document, not this field. Same reasoning for final_teaching_grade,
-- final_assignments_grade, and overall_notes (the trainer's commentary
-- tied to that grade decision) -- all four now always null for a
-- trainee, never conditionally revealed. Stage 3 progress-record detail
-- is untouched (still reveals on trainer_signoff_final_at) -- that's
-- formative feedback, not "the grade" itself, and wasn't part of this
-- correction.

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
  stage3_required boolean,
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
    case when r.trainer_signoff_final_at is not null then r.stage3_required end,
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
