-- 0306 -- Stage 3 is a warning, so the candidate has to be able to read it.
--
-- get_my_celta5_record() masked all eight Stage 3 fields behind
-- trainer_signoff_final_at -- the tutor's sign-off on the FINAL declaration,
-- which happens on the last day of the course. So a candidate could not see
-- their Stage 3 record until after the course was effectively over, and
-- could never sign it, because the page gates the whole Stage 3 block (and
-- its sign-off button) on stage3_finalized_at.
--
-- That inverts both the document and the point of the record:
--
--   Administration Handbook 10.2 -- "Stage 3 progress checks must be
--   completed by tutors in the final third of the course" for candidates not
--   making the expected progress. A warning delivered after the last day is
--   not a warning.
--
--   CELTA 5 itself puts the Stage 3 candidate signature (printed p26) BEFORE
--   the final-day section (p27). The candidate signs Stage 3, then the
--   final declaration.
--
-- Three candidates have a finalised Stage 3 they cannot see right now, and
-- they are by definition the three who most need to read it.
--
-- The release event for Stage 3 is the tutor finalising it, exactly as
-- stage1_released_at is for Stage 1, so that is what now gates it.
--
-- The same pass fixes Stage 1's content, which was gated on
-- stage2_completed_at -- a candidate in the first third of the course would
-- have seen "Filed by your tutor" above an empty strengths box and an empty
-- action plan. Nobody is in that state today, because every released Stage 1
-- happens to have a completed Stage 2 behind it, but the course does not
-- guarantee that order.
--
-- Nothing else changes: 0305's body, with two masks repointed.

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
  updated_at timestamptz,
  stage1_released_at timestamptz,
  stage1_tutor_signature_name text,
  stage1_candidate_signature_name text,
  stage1_candidate_signed_at timestamptz,
  stage2_tutor_signature_name text,
  stage2_candidate_signature_name text,
  stage3_tutor_signature_name text,
  stage3_candidate_signature_name text,
  stage3_candidate_signed_at timestamptz,
  final_tutor_signature_name text,
  final_candidate_signature_name text,
  final_checklist_tp boolean,
  final_checklist_observations boolean,
  final_checklist_assignments boolean,
  final_checklist_own_work boolean,
  final_checklist_all_records boolean,
  portfolio_terms_confirmed_at timestamptz,
  portfolio_terms_signature_name text,
  appeals_read_confirmed_at timestamptz,
  appeals_read_signature_name text,
  grade_review_tutor_comments text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id, r.course_id, r.trainee_id,
    r.hours_attended,
    case when r.stage1_released_at is not null then r.stage1_tutorial_given end,
    case when r.stage1_released_at is not null then r.stage1_hours_taught end,
    case when r.stage1_released_at is not null then r.stage1_strengths end,
    case when r.stage1_released_at is not null then r.stage1_action_plan end,
    case when r.stage1_released_at is not null then r.stage1_completed_at end,
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
    case when r.stage3_finalized_at is not null then r.stage3_tutorial_required end,
    case when r.stage3_finalized_at is not null then r.stage3_tutorial_given end,
    case when r.stage3_finalized_at is not null then r.stage3_hours_taught end,
    case when r.stage3_finalized_at is not null then r.stage3_tutor_overall end,
    case when r.stage3_finalized_at is not null then r.stage3_tutor_notes end,
    case when r.stage3_finalized_at is not null then r.stage3_tutor_written_assignments_notes end,
    case when r.stage3_finalized_at is not null then r.stage3_tutor_other_notes end,
    r.stage3_finalized_at,
    null::text, -- final_recommended_grade -- never revealed to trainee
    null::text, -- final_teaching_grade -- never revealed to trainee
    null::text, -- final_assignments_grade -- never revealed to trainee
    null::text, -- overall_notes -- never revealed to trainee
    r.admin_access_granted_at,
    r.admin_access_level,
    r.trainer_signoff_final_at,
    r.trainee_signoff_final_at,
    r.updated_at,
    r.stage1_released_at,
    r.stage1_tutor_signature_name,
    r.stage1_candidate_signature_name,
    r.stage1_candidate_signed_at,
    r.stage2_tutor_signature_name,
    r.stage2_candidate_signature_name,
    r.stage3_tutor_signature_name,
    r.stage3_candidate_signature_name,
    r.stage3_candidate_signed_at,
    r.final_tutor_signature_name,
    r.final_candidate_signature_name,
    r.final_checklist_tp,
    r.final_checklist_observations,
    r.final_checklist_assignments,
    r.final_checklist_own_work,
    r.final_checklist_all_records,
    r.portfolio_terms_confirmed_at,
    r.portfolio_terms_signature_name,
    r.appeals_read_confirmed_at,
    r.appeals_read_signature_name,
    case when r.trainer_signoff_final_at is not null then r.grade_review_tutor_comments end
  from public.celta5_records r
  where r.trainee_id = auth.uid();
$$;

grant execute on function public.get_my_celta5_record() to authenticated;

notify pgrst, 'reload schema';

select
  count(*) filter (where stage3_finalized_at is not null) as stage3_records_visible_to_their_candidate
from public.celta5_records;
