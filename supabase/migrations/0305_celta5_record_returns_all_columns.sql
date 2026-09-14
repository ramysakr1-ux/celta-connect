-- 0305 -- The candidate's own CELTA 5 record was missing 21 of its columns.
--
-- get_my_celta5_record() is the ONLY way the candidate's page reads their
-- record. It was last rebuilt at 0253 and never caught up with the columns
-- added around it, so the page reads 47 fields off `record` and the function
-- returns 39 of them. Every one of the missing 21 came back undefined.
--
-- What that did, on every candidate in both courses:
--
--   stage1_released_at   The whole Stage One block -- strengths, action plan,
--                        the tutor's signature and the candidate's sign-off
--                        button -- is gated on this. Undefined means the
--                        candidate permanently saw "Not released yet. Your
--                        tutor is preparing your Stage One record", however
--                        long ago the tutor filed it. 22 candidates are in
--                        that state right now, and none of them can sign a
--                        record the real CELTA 5 requires them to sign
--                        (printed p15).
--
--   the signature names  Stage 2's record showed "Tutor's signature: —" with
--                        "M. Webb" sitting in the column.
--
--   the confirmations    portfolio terms and appeals-procedure confirmations
--   and final checklist  could be given but never showed as given.
--
-- Everything deliberately withheld at 0253 stays withheld: the final grades
-- and overall notes still return null. grade_review_tutor_comments is tutor
-- commentary rather than a signature, so it is gated behind
-- trainer_signoff_final_at like the rest of the final-day fields.
--
-- The function body below is 0253's, unchanged, with the 21 columns appended
-- in matching order on both the RETURNS TABLE and the SELECT.

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

select count(*) as columns_returned
from information_schema.columns
where table_schema = 'public'
  and table_name = 'get_my_celta5_record';
