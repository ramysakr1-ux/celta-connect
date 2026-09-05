-- Today's own datasets in one round trip (the roster comes from
-- hub_roster_bundle, migration 0273). Same columns and filters as the
-- page's two Promise.all waves in src/app/trainer/(hub)/page.tsx; the
-- page's logic is unchanged. Service-role only, like 0273.

create or replace function public.hub_today_bundle(p_course_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with
  tids as (select id from profiles where course_id = p_course_id and role = 'trainee'),
  subs as (select id, tp_group_id from course_subgroups where course_id = p_course_id),
  sched as (select tp_number, tp_coursebook_id from course_tp_schedule where course_id = p_course_id),
  asg as (select id, assignment_type, due_date, first_submitted_at, second_marker_recorded_at from assignments where course_id = p_course_id)
  select jsonb_build_object(
    'course', (select to_jsonb(c) from courses c where c.id = p_course_id),
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.event_date, e.event_time), '[]'::jsonb) from course_timetable_events e where e.course_id = p_course_id),
    'lessons', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, tp_number, taught_at from plan_assignments where course_id = p_course_id and taught_at is not null) x),
    'assignments', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from asg a),
    'open_concerns', (select count(*)::int from concerns where course_id = p_course_id and response is null),
    'tp_groups', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select id, name, tutor_profile_id from course_tp_groups where course_id = p_course_id) x),
    'subgroups', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from subs s),
    'schedule', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from sched s),
    'feedback', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select trainee_id, tp_number, submitted_at from tp_feedback where trainee_id in (select id from tids)) x),
    'unreviewed_findings', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select assignment_id from plagiarism_scanner_findings where assignment_id in (select id from asg) and reviewed_at is null) x),
    'celta5', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select provisional_grade, provisional_approved_at, final_recommended_grade from celta5_records where trainee_id in (select id from tids)) x),
    'members', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select subgroup_id, trainee_id from course_subgroup_members where subgroup_id in (select id from subs)) x),
    'books', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (select id, level from tp_coursebooks where id in (select tp_coursebook_id from sched where tp_coursebook_id is not null)) x)
  );
$$;

revoke execute on function public.hub_today_bundle(uuid) from public, anon, authenticated;
