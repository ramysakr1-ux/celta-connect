-- The roster in one round trip.
--
-- Perf audit, 5 Sep 2026, round 4. After the row policies were fixed and
-- hub pages moved to service-role reads, twenty people opening Roster at
-- the same second still waited ~3 s: each request was ~26 PostgREST calls
-- in three waves, and 20 x 26 land on the database at once. This function
-- returns the same 24 datasets, same columns, same filters, as one JSON
-- document -- the app's own logic (src/lib/roster.ts) is unchanged and
-- reads the fields by the same names.
--
-- Service-role only: EXECUTE is revoked from anon and authenticated, so it
-- can never be a way around row security for a signed-in user; the app
-- calls it only after hubReadClient() has established the caller is a
-- tutor on this course.

create or replace function public.hub_roster_bundle(p_course_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with
  trainees as (
    select id, full_name, email, phone, course_status
    from profiles where course_id = p_course_id and role = 'trainee' order by full_name
  ),
  tids as (select id from trainees),
  blocks as (select id from stage2_tutorial_blocks where course_id = p_course_id),
  sessions as (select id from filmed_observation_sessions where course_id = p_course_id),
  crs as (select total_hours, center_id from courses where id = p_course_id)
  select jsonb_build_object(
    'trainees', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from trainees t),
    'stage2_blocks', (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from blocks b),
    'tutorial_invites', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, stage, confirmed_at from individual_tutorial_invites where course_id = p_course_id) x),
    'filmed_events', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select id from course_timetable_events where course_id = p_course_id and type = 'milestone' and title ilike 'Filmed observation%') x),
    'filmed_sessions', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from sessions s),
    'course', (select to_jsonb(c) from crs c),
    'taught_plans', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, tp_number from plan_assignments where course_id = p_course_id and taught_at is not null) x),
    'feedback', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, tp_number, grade, submitted_at, strengths_planning, strengths_teaching, action_points_planning, action_points_teaching from tp_feedback where trainee_id in (select id from tids)) x),
    'assignments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, assignment_type, first_status, resubmission_status, due_date, first_submitted_at, resubmission_submitted_at from assignments where course_id = p_course_id) x),
    'celta5_records', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, hours_attended, provisional_grade, provisional_grade_upper, stage1_completed_at, stage2_candidate_submitted_at, stage2_completed_at, stage2_moved_earlier_at, stage2_moved_earlier_reason, trainee_signoff_final_at, trainer_signoff_final_at, stage3_tutorial_required, stage3_finalized_at, stage3_moved_earlier_at, stage3_moved_earlier_reason from celta5_records where course_id = p_course_id) x),
    'matrix', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, criteria_code, tutor_status_stage2 from celta5_matrix where course_id = p_course_id) x),
    'supervised_events', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select id from course_timetable_events where course_id = p_course_id and type = 'supervised_session') x),
    'supervised_completions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select timetable_event_id, trainee_id, submitted_at, time_spent_seconds from supervised_session_completions where trainee_id in (select id from tids)) x),
    'tp_plans', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, tp_number, submitted_at from tp_plans where trainee_id in (select id from tids)) x),
    'tp_self_evals', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, tp_number, submitted_at from tp_self_evaluations where trainee_id in (select id from tids)) x),
    'observations', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, filmed, length_minutes from observations where course_id = p_course_id) x),
    'stage2_slots', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select position, trainee_id, booked_at from stage2_tutorial_slots where block_id in (select id from blocks)) x),
    'error_log', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select logged_by_candidate_id from class_error_log where course_id = p_course_id) x),
    'obs_tasks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select id from observation_tasks where course_id = p_course_id) x),
    'obs_task_submissions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, task_id from observation_task_submissions where trainee_id in (select id from tids)) x),
    'pct_sections', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'pre_course_task_items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id)), '[]'::jsonb) from pre_course_task_items i where i.section_id = s.id))), '[]'::jsonb) from pre_course_task_sections s where s.center_id = (select center_id from crs)),
    'pct_responses', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, response from pre_course_task_responses where trainee_id in (select id from tids)) x),
    'filmed_tasks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select id, session_id from filmed_observation_tasks where session_id in (select id from sessions)) x),
    'filmed_responses', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, task_id, completed_at from filmed_observation_task_responses where trainee_id in (select id from tids) and completed_at is not null) x)
  );
$$;

revoke execute on function public.hub_roster_bundle(uuid) from public, anon, authenticated;
