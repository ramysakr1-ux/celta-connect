-- Row security checks evaluated once per query, not once per row.
--
-- Perf audit, 5 Sep 2026. EXPLAIN ANALYZE on the demo course as the
-- signed-in tutor: reading its 179 timetable rows took 52 ms, because the
-- policy filter calls is_trainer() and current_course_id() on EVERY row and
-- each call is a SECURITY DEFINER lookup of the caller's profile. The same
-- 18 roster queries ran in 170 ms in parallel as the service role and 666 ms
-- as the tutor -- the difference is this, repeated on every table.
--
-- Postgres evaluates a bare STABLE function per row in a filter; wrapped as
-- a scalar subselect -- (select is_trainer()) -- it becomes an InitPlan and
-- runs once per query. Supabase documents this as the standard RLS
-- optimisation. The array-returning helpers (held_center_ids and friends)
-- are left bare: `= any((select f()))` parses as a row subquery, and they
-- only run inside already-hashed subplans. Nothing about WHO may see WHAT
-- changes: every policy body is identical except for the wrapping.
-- Generated mechanically from the live pg_policies (298 scanned,
-- 257 rewritten); the DOWN file in the session scratchpad restores
-- the originals.

alter policy "admissions_notifications: admissions staff insert their centre'" on public.admissions_notifications
  with check (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "admissions_notifications: admissions staff read their centre's" on public.admissions_notifications
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "applicant_emails: admissions staff read their centre's" on public.applicant_emails
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "applicants: admissions staff handle their centre's" on public.applicants
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "application_links: admissions staff manage their centre's" on public.application_links
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))))
  with check (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "application_writing_prompts: admissions staff manage their cent" on public.application_writing_prompts
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))))
  with check (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "assessor requests: candidate creates own" on public.assessor_meeting_requests
  with check ((trainee_id = (select auth.uid())));

alter policy "assessor requests: candidate withdraws own" on public.assessor_meeting_requests
  using ((trainee_id = (select auth.uid())))
  with check ((trainee_id = (select auth.uid())));

alter policy "assessor requests: own row" on public.assessor_meeting_requests
  using ((trainee_id = (select auth.uid())));

alter policy "assignment_section_responses: admin manages in their center" on public.assignment_section_responses
  using (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (assignments a
     JOIN courses c ON ((c.id = a.course_id)))
  WHERE ((a.id = assignment_section_responses.assignment_id) AND (c.center_id = ANY (held_center_ids())))))))
  with check (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (assignments a
     JOIN courses c ON ((c.id = a.course_id)))
  WHERE ((a.id = assignment_section_responses.assignment_id) AND (c.center_id = ANY (held_center_ids())))))));

alter policy "assignment_section_responses: trainee reads their own" on public.assignment_section_responses
  using ((EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = assignment_section_responses.assignment_id) AND (a.trainee_id = (select auth.uid()))))));

alter policy "assignment_section_responses: trainee writes while unlocked" on public.assignment_section_responses
  using ((EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = assignment_section_responses.assignment_id) AND (a.trainee_id = (select auth.uid())) AND ((a.first_status = 'not_submitted'::submission_status) OR ((a.first_status = 'resubmission_required'::submission_status) AND (a.resubmission_status = 'not_submitted'::submission_status)))))))
  with check ((EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = assignment_section_responses.assignment_id) AND (a.trainee_id = (select auth.uid())) AND ((a.first_status = 'not_submitted'::submission_status) OR ((a.first_status = 'resubmission_required'::submission_status) AND (a.resubmission_status = 'not_submitted'::submission_status)))))));

alter policy "assignment_section_responses: trainer manages in their course" on public.assignment_section_responses
  using (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = assignment_section_responses.assignment_id) AND (a.course_id = (select current_course_id())))))))
  with check (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = assignment_section_responses.assignment_id) AND (a.course_id = (select current_course_id())))))));

alter policy "assignment_templates: trainer/admin manage their center's templ" on public.assignment_templates
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "assignment_type_definitions: admin manages their center's own t" on public.assignment_type_definitions
  using (((select is_admin()) AND (center_id = ANY (held_center_ids()))))
  with check (((select is_admin()) AND (center_id = ANY (held_center_ids()))));

alter policy "assignments: admin manages assignments in their center" on public.assignments
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "assignments: trainee can read their own assignments" on public.assignments
  using ((trainee_id = (select auth.uid())));

alter policy "assignments: trainer manages assignments in their course" on public.assignments
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "attendance_absences: admin manages absences in their center" on public.attendance_absences
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "attendance_absences: trainee can read their own absences" on public.attendance_absences
  using ((trainee_id = (select auth.uid())));

alter policy "attendance_absences: trainee reports their own absence" on public.attendance_absences
  with check (((trainee_id = (select auth.uid())) AND (course_id = (select current_course_id())) AND (tutor_comment IS NULL)));

alter policy "attendance_absences: trainer manages absences in their course" on public.attendance_absences
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "branch_referral_requests: admissions staff read their centre's" on public.branch_referral_requests
  using (((select can_handle_admissions()) AND ((from_center_id = ANY (held_center_ids())) OR (to_center_id = ANY (held_center_ids())))));

alter policy "celta5_matrix: admin can edit matrix granted at edit level" on public.celta5_matrix
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids())))) AND (EXISTS ( SELECT 1
   FROM celta5_records r
  WHERE ((r.trainee_id = celta5_matrix.trainee_id) AND (r.admin_access_granted_at IS NOT NULL) AND (r.admin_access_level = 'edit'::text))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids())))) AND (EXISTS ( SELECT 1
   FROM celta5_records r
  WHERE ((r.trainee_id = celta5_matrix.trainee_id) AND (r.admin_access_granted_at IS NOT NULL) AND (r.admin_access_level = 'edit'::text))))));

alter policy "celta5_matrix: admin can read granted matrix" on public.celta5_matrix
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids())))) AND (EXISTS ( SELECT 1
   FROM celta5_records r
  WHERE ((r.trainee_id = celta5_matrix.trainee_id) AND (r.admin_access_granted_at IS NOT NULL))))));

alter policy "celta5_matrix: trainer manages matrix in their course" on public.celta5_matrix
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "celta5_records: admin can edit records granted at edit level" on public.celta5_records
  using (((select is_admin()) AND (admin_access_granted_at IS NOT NULL) AND (admin_access_level = 'edit'::text) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (admin_access_granted_at IS NOT NULL) AND (admin_access_level = 'edit'::text) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "celta5_records: admin can read granted records" on public.celta5_records
  using (((select is_admin()) AND (admin_access_granted_at IS NOT NULL) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "celta5_records: trainer manages records in their course" on public.celta5_records
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "centers: admins can update their own center" on public.centers
  using (((id = ANY (held_center_ids())) AND (select is_admin())));

alter policy "centre_areas: the centre's admins can see who holds what" on public.centre_areas
  using (((profile_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::user_role, 'platform_owner'::user_role])) AND (p.center_id = centre_areas.center_id))))));

alter policy "centre_assignment_criteria: admin manages their centre's criter" on public.centre_assignment_criteria
  using (((select is_admin()) AND (center_id = ANY (held_center_ids()))))
  with check (((select is_admin()) AND (center_id = ANY (held_center_ids()))));

alter policy "centre_branch_visibility: a centre owner at either branch sets " on public.centre_branch_visibility
  using ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.revoked_at IS NULL) AND (r.role = 'centre_owner'::text) AND (r.center_id = ANY (ARRAY[centre_branch_visibility.viewer_center_id, centre_branch_visibility.target_center_id])) AND (r.profile_id = (select auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.revoked_at IS NULL) AND (r.role = 'centre_owner'::text) AND (r.center_id = ANY (ARRAY[centre_branch_visibility.viewer_center_id, centre_branch_visibility.target_center_id])) AND (r.profile_id = (select auth.uid()))))));

alter policy "centre_branch_visibility: centre-roles holders at either branch" on public.centre_branch_visibility
  using ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.revoked_at IS NULL) AND (r.center_id = ANY (ARRAY[centre_branch_visibility.viewer_center_id, centre_branch_visibility.target_center_id])) AND (r.profile_id = (select auth.uid()))))));

alter policy "centre_custom_capabilities: a centre owner manages their centre" on public.centre_custom_capabilities
  using ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.revoked_at IS NULL) AND (r.role = 'centre_owner'::text) AND (r.center_id = centre_custom_capabilities.center_id) AND (r.profile_id = (select auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.revoked_at IS NULL) AND (r.role = 'centre_owner'::text) AND (r.center_id = centre_custom_capabilities.center_id) AND (r.profile_id = (select auth.uid()))))));

alter policy "centre_custom_capabilities: centre-roles holders read their cen" on public.centre_custom_capabilities
  using ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.revoked_at IS NULL) AND (r.center_id = centre_custom_capabilities.center_id) AND (r.profile_id = (select auth.uid()))))));

alter policy "centre_custom_roles: a centre owner manages their centre's cust" on public.centre_custom_roles
  using ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.revoked_at IS NULL) AND (r.role = 'centre_owner'::text) AND (r.center_id = centre_custom_roles.center_id) AND (r.profile_id = (select auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.revoked_at IS NULL) AND (r.role = 'centre_owner'::text) AND (r.center_id = centre_custom_roles.center_id) AND (r.profile_id = (select auth.uid()))))));

alter policy "centre_custom_roles: centre-roles holders read their centre's c" on public.centre_custom_roles
  using ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.revoked_at IS NULL) AND (r.center_id = centre_custom_roles.center_id) AND (r.profile_id = (select auth.uid()))))));

alter policy "centre_owner_actions: readable inside the centre" on public.centre_owner_actions
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::user_role, 'platform_owner'::user_role])) AND (p.center_id = centre_owner_actions.center_id)))));

alter policy "centre_permission_overrides: a centre owner manages their centr" on public.centre_permission_overrides
  using ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.revoked_at IS NULL) AND (r.role = 'centre_owner'::text) AND (r.center_id = centre_permission_overrides.center_id) AND (r.profile_id = (select auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.revoked_at IS NULL) AND (r.role = 'centre_owner'::text) AND (r.center_id = centre_permission_overrides.center_id) AND (r.profile_id = (select auth.uid()))))));

alter policy "centre_permission_overrides: centre-roles holders read their ce" on public.centre_permission_overrides
  using ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.revoked_at IS NULL) AND (r.center_id = centre_permission_overrides.center_id) AND (r.profile_id = (select auth.uid()))))));

alter policy "centre_roles: admins see grants in their own centre" on public.centre_roles
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::user_role, 'platform_owner'::user_role])) AND (p.center_id = centre_roles.center_id)))));

alter policy "centre_roles: you can see your own grants" on public.centre_roles
  using ((profile_id = (select auth.uid())));

alter policy "class_error_log: course members view the pool" on public.class_error_log
  using ((course_id = (select current_course_id())));

alter policy "class_error_log: trainees log their own course's observations" on public.class_error_log
  with check ((("current_role"() = 'trainee'::user_role) AND (logged_by_candidate_id = (select auth.uid())) AND (course_id = (select current_course_id()))));

alter policy "concerns: admin manages their center's concerns" on public.concerns
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "concerns: trainee reads and creates their own" on public.concerns
  using ((trainee_id = (select auth.uid())));

alter policy "concerns: trainee submits their own" on public.concerns
  with check (((trainee_id = (select auth.uid())) AND (course_id = (select current_course_id()))));

alter policy "concerns: trainer manages their course's concerns" on public.concerns
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "course_access_tokens: trainer/admin manage their course" on public.course_access_tokens
  using ((((select is_trainer()) OR (select is_admin())) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "course_administrator_scope: visible with its grant" on public.course_administrator_scope
  using ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.id = course_administrator_scope.centre_role_id) AND ((r.profile_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::user_role, 'platform_owner'::user_role])) AND (p.center_id = r.center_id)))))))));

alter policy "course_broadcasts: admin manages broadcasts in their center" on public.course_broadcasts
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids())))) AND (author_id = (select auth.uid()))));

alter policy "course_broadcasts: admin reads broadcasts in their center" on public.course_broadcasts
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "course_broadcasts: cohort reads their course's broadcasts" on public.course_broadcasts
  using (((course_id = (select current_course_id())) AND (((visible_to_tp_group_id IS NULL) AND (visible_to_subgroup_id IS NULL) AND (visible_to_trainee_id IS NULL)) OR ((visible_to_subgroup_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM course_subgroup_members m
  WHERE ((m.subgroup_id = course_broadcasts.visible_to_subgroup_id) AND (m.trainee_id = (select auth.uid())))))) OR ((visible_to_tp_group_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (course_subgroup_members m
     JOIN course_subgroups g ON ((g.id = m.subgroup_id)))
  WHERE ((g.tp_group_id = course_broadcasts.visible_to_tp_group_id) AND (m.trainee_id = (select auth.uid())))))) OR ((visible_to_trainee_id IS NOT NULL) AND (visible_to_trainee_id = (select auth.uid()))))));

alter policy "course_broadcasts: trainer manages their course's broadcasts" on public.course_broadcasts
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id())) AND (author_id = (select auth.uid()))));

alter policy "course_close_outs: admin reads their centre's close-outs" on public.course_close_outs
  using (((select is_admin()) AND (center_id = ANY (held_center_ids()))));

alter policy "course_subgroup_members: admin manages members in their center" on public.course_subgroup_members
  using (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (course_subgroups g
     JOIN courses c ON ((c.id = g.course_id)))
  WHERE ((g.id = course_subgroup_members.subgroup_id) AND (c.center_id = ANY (held_center_ids())))))))
  with check (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (course_subgroups g
     JOIN courses c ON ((c.id = g.course_id)))
  WHERE ((g.id = course_subgroup_members.subgroup_id) AND (c.center_id = ANY (held_center_ids())))))));

alter policy "course_subgroup_members: trainee reads their own membership" on public.course_subgroup_members
  using ((trainee_id = (select auth.uid())));

alter policy "course_subgroup_members: trainer manages members in their cours" on public.course_subgroup_members
  using (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM course_subgroups g
  WHERE ((g.id = course_subgroup_members.subgroup_id) AND (g.course_id = (select current_course_id())))))))
  with check (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM course_subgroups g
  WHERE ((g.id = course_subgroup_members.subgroup_id) AND (g.course_id = (select current_course_id())))))));

alter policy "course_subgroups: admin manages subgroups in their center" on public.course_subgroups
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "course_subgroups: trainer manages subgroups in their course" on public.course_subgroups
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "course_timetable_events: admin manages timetables in their cent" on public.course_timetable_events
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "course_timetable_events: admin reads timetables in their center" on public.course_timetable_events
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "course_timetable_events: cohort reads their course's timetable" on public.course_timetable_events
  using ((course_id = (select current_course_id())));

alter policy "course_timetable_events: trainer manages their course's timetab" on public.course_timetable_events
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "course_tp_group_tutors: admin in their centre" on public.course_tp_group_tutors
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "course_tp_group_tutors: trainers on the course" on public.course_tp_group_tutors
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "course_tp_groups: admin manages tp groups in their center" on public.course_tp_groups
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "course_tp_groups: trainer manages tp groups in their course" on public.course_tp_groups
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "course_tp_schedule: admin manages schedule in their center" on public.course_tp_schedule
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "course_tp_schedule: trainees can read their own course's schedu" on public.course_tp_schedule
  using ((course_id = (select current_course_id())));

alter policy "course_tp_schedule: trainer manages schedule in their course" on public.course_tp_schedule
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "course_tutors: admin manages tutors in their center's courses" on public.course_tutors
  using (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_tutors.course_id) AND (c.center_id = ANY (held_center_ids())))))))
  with check (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_tutors.course_id) AND (c.center_id = ANY (held_center_ids())))))));

alter policy "course_tutors: trainee reads their course's tutor list" on public.course_tutors
  using ((course_id = (select current_course_id())));

alter policy "course_tutors: trainer reads their course's tutor list" on public.course_tutors
  using (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "courses: admins manage courses in their center" on public.courses
  using (((center_id = ANY (held_center_ids())) AND (select is_admin())))
  with check (((center_id = ANY (held_center_ids())) AND (select is_admin())));

alter policy "courses: trainer updates their own course" on public.courses
  using (((select is_trainer()) AND (id = (select current_course_id()))))
  with check (((select is_trainer()) AND (id = (select current_course_id()))));

alter policy "deferral_transfers: trainer/admin read their centre's transfers" on public.deferral_transfers
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "email_bounce_tasks: admissions staff read their centre's" on public.email_bounce_tasks
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "feedback_assist_examples: trainer deletes their own examples" on public.feedback_assist_examples
  using (((select is_trainer()) AND (course_id = (select current_course_id())) AND (profile_id = (select auth.uid()))));

alter policy "feedback_assist_examples: trainer inserts their own examples" on public.feedback_assist_examples
  with check (((select is_trainer()) AND (course_id = (select current_course_id())) AND (profile_id = (select auth.uid()))));

alter policy "feedback_assist_examples: trainer reads course examples" on public.feedback_assist_examples
  using (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "feedback_assist_examples: trainer updates their own examples" on public.feedback_assist_examples
  using (((select is_trainer()) AND (course_id = (select current_course_id())) AND (profile_id = (select auth.uid()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id())) AND (profile_id = (select auth.uid()))));

alter policy "feedback_assist_settings: trainer manages their own setting" on public.feedback_assist_settings
  using (((select is_trainer()) AND (course_id = (select current_course_id())) AND (profile_id = (select auth.uid()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id())) AND (profile_id = (select auth.uid()))));

alter policy "feedback_style_examples: trainer/admin manage their center's st" on public.feedback_style_examples
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "filmed_observation_breaks: admin manages their center's breaks" on public.filmed_observation_breaks
  using (((select is_admin()) AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = ANY (held_center_ids()))))))))
  with check (((select is_admin()) AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = ANY (held_center_ids()))))))));

alter policy "filmed_observation_breaks: cohort reads their course's breaks" on public.filmed_observation_breaks
  using ((session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id = (select current_course_id())))));

alter policy "filmed_observation_breaks: trainer manages their course's break" on public.filmed_observation_breaks
  using (((select is_trainer()) AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id = (select current_course_id()))))))
  with check (((select is_trainer()) AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id = (select current_course_id()))))));

alter policy "filmed_observation_messages: cohort posts as themselves" on public.filmed_observation_messages
  with check (((author_id = (select auth.uid())) AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id = (select current_course_id()))))));

alter policy "filmed_observation_messages: cohort reads their course's messag" on public.filmed_observation_messages
  using ((session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id = (select current_course_id())))));

alter policy "filmed_observation_sessions: admin manages their center's sessi" on public.filmed_observation_sessions
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "filmed_observation_sessions: cohort reads their course's sessio" on public.filmed_observation_sessions
  using ((course_id = (select current_course_id())));

alter policy "filmed_observation_sessions: trainer manages their course's ses" on public.filmed_observation_sessions
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "filmed_observation_task_responses: admin reads their center's r" on public.filmed_observation_task_responses
  using (((select is_admin()) AND (task_id IN ( SELECT t.id
   FROM (filmed_observation_tasks t
     JOIN filmed_observation_sessions s ON ((s.id = t.session_id)))
  WHERE (s.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = ANY (held_center_ids()))))))));

alter policy "filmed_observation_task_responses: trainee manages their own re" on public.filmed_observation_task_responses
  using (((trainee_id = (select auth.uid())) AND (task_id IN ( SELECT t.id
   FROM (filmed_observation_tasks t
     JOIN filmed_observation_sessions s ON ((s.id = t.session_id)))
  WHERE (s.course_id = (select current_course_id()))))))
  with check (((trainee_id = (select auth.uid())) AND (task_id IN ( SELECT t.id
   FROM (filmed_observation_tasks t
     JOIN filmed_observation_sessions s ON ((s.id = t.session_id)))
  WHERE (s.course_id = (select current_course_id()))))));

alter policy "filmed_observation_task_responses: trainer reads their course's" on public.filmed_observation_task_responses
  using (((select is_trainer()) AND (task_id IN ( SELECT t.id
   FROM (filmed_observation_tasks t
     JOIN filmed_observation_sessions s ON ((s.id = t.session_id)))
  WHERE (s.course_id = (select current_course_id()))))));

alter policy "filmed_observation_tasks: admin manages their center's tasks" on public.filmed_observation_tasks
  using (((select is_admin()) AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = ANY (held_center_ids()))))))))
  with check (((select is_admin()) AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = ANY (held_center_ids()))))))));

alter policy "filmed_observation_tasks: cohort reads their course's tasks" on public.filmed_observation_tasks
  using ((session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id = (select current_course_id())))));

alter policy "filmed_observation_tasks: trainer manages their course's tasks" on public.filmed_observation_tasks
  using (((select is_trainer()) AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id = (select current_course_id()))))))
  with check (((select is_trainer()) AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id = (select current_course_id()))))));

alter policy "course staff read views" on public.filmed_observation_views
  using ((EXISTS ( SELECT 1
   FROM profiles staff,
    profiles candidate
  WHERE ((staff.id = (select auth.uid())) AND (candidate.id = filmed_observation_views.trainee_id) AND (staff.role = ANY (ARRAY['trainer'::user_role, 'admin'::user_role, 'platform_owner'::user_role])) AND ((staff.role = ANY (ARRAY['admin'::user_role, 'platform_owner'::user_role])) OR (staff.course_id = candidate.course_id))))));

alter policy "own views insertable" on public.filmed_observation_views
  with check ((trainee_id = (select auth.uid())));

alter policy "own views readable" on public.filmed_observation_views
  using ((trainee_id = (select auth.uid())));

alter policy "finances: admins only, scoped to their center" on public.finances
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "fol_claims: trainees claim for their own course" on public.fol_claims
  with check ((("current_role"() = 'trainee'::user_role) AND (candidate_id = (select auth.uid())) AND (course_id = (select current_course_id()))));

alter policy "fol_claims: trainees view their own" on public.fol_claims
  using ((("current_role"() = 'trainee'::user_role) AND (candidate_id = (select auth.uid())) AND (course_id = (select current_course_id()))));

alter policy "fol_claims: trainer/admin view their course's" on public.fol_claims
  using ((((select is_admin()) OR (select is_trainer())) AND (course_id = (select current_course_id()))));

alter policy "formal_letters: admin manages their center's letters" on public.formal_letters
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "formal_letters: trainee acknowledges their own letter" on public.formal_letters
  using ((trainee_id = (select auth.uid())))
  with check ((trainee_id = (select auth.uid())));

alter policy "formal_letters: trainee reads their own letters" on public.formal_letters
  using ((trainee_id = (select auth.uid())));

alter policy "formal_letters: trainer manages their course's letters" on public.formal_letters
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "grade_query_replies: trainer/admin manage replies in their cour" on public.grade_query_replies
  using ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))));

alter policy "gtky_assignments: trainee picks their own" on public.gtky_assignments
  using ((trainee_id = (select auth.uid())))
  with check ((trainee_id = (select auth.uid())));

alter policy "gtky_assignments: trainee reads their own" on public.gtky_assignments
  using ((trainee_id = (select auth.uid())));

alter policy "gtky_assignments: trainer/admin manage their course" on public.gtky_assignments
  using ((((select is_admin()) OR (select is_trainer())) AND (course_id = (select current_course_id()))))
  with check ((((select is_admin()) OR (select is_trainer())) AND (course_id = (select current_course_id()))));

alter policy "individual_tutorial_invites: admin manages invites in their cen" on public.individual_tutorial_invites
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "individual_tutorial_invites: trainee confirms their own invite" on public.individual_tutorial_invites
  using ((trainee_id = (select auth.uid())))
  with check ((trainee_id = (select auth.uid())));

alter policy "individual_tutorial_invites: trainee reads their own invite" on public.individual_tutorial_invites
  using ((trainee_id = (select auth.uid())));

alter policy "individual_tutorial_invites: trainer manages invites in their c" on public.individual_tutorial_invites
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "interview_availability_patterns: admissions staff manage their " on public.interview_availability_patterns
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))))
  with check (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "interview_blocks: admissions staff manage their centre's" on public.interview_blocks
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))))
  with check (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "interview_questions: admissions staff manage their centre's" on public.interview_questions
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))))
  with check (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "interview_slots: admissions staff manage their centre's" on public.interview_slots
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))))
  with check (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "malpractice_cases: trainer/admin manage cases in their course" on public.malpractice_cases
  using ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))));

alter policy "malpractice_concern_notes: trainer/admin manage notes in their " on public.malpractice_concern_notes
  using ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))));

alter policy "malpractice_outcome_options: trainer/admin manage their center'" on public.malpractice_outcome_options
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "marking_guidance_entries: trainers read and write their centre'" on public.marking_guidance_entries
  using (((select is_trainer()) AND (center_id = ANY (held_center_ids()))))
  with check (((select is_trainer()) AND (center_id = ANY (held_center_ids()))));

alter policy "observation_task_submissions: admin reads their center's submis" on public.observation_task_submissions
  using (((select is_admin()) AND (task_id IN ( SELECT observation_tasks.id
   FROM observation_tasks
  WHERE (observation_tasks.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = ANY (held_center_ids()))))))));

alter policy "observation_task_submissions: trainee manages their own submiss" on public.observation_task_submissions
  using (((trainee_id = (select auth.uid())) AND (task_id IN ( SELECT observation_tasks.id
   FROM observation_tasks
  WHERE (observation_tasks.course_id = (select current_course_id()))))))
  with check (((trainee_id = (select auth.uid())) AND (task_id IN ( SELECT observation_tasks.id
   FROM observation_tasks
  WHERE (observation_tasks.course_id = (select current_course_id()))))));

alter policy "observation_task_submissions: trainer reads their course's subm" on public.observation_task_submissions
  using (((select is_trainer()) AND (task_id IN ( SELECT observation_tasks.id
   FROM observation_tasks
  WHERE (observation_tasks.course_id = (select current_course_id()))))));

alter policy "observation_tasks: admin manages their center's tasks" on public.observation_tasks
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "observation_tasks: trainee reads their course's tasks" on public.observation_tasks
  using ((course_id = (select current_course_id())));

alter policy "observation_tasks: trainer manages their course's tasks" on public.observation_tasks
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "observations: admin can read observations in their center" on public.observations
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "observations: trainee manages their own observations" on public.observations
  using ((trainee_id = (select auth.uid())))
  with check ((trainee_id = (select auth.uid())));

alter policy "observations: trainer can read observations in their course" on public.observations
  using (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "organisation_roles: you can see your own" on public.organisation_roles
  using ((profile_id = (select auth.uid())));

alter policy "organisations: visible to their centres' admins" on public.organisations
  using (((EXISTS ( SELECT 1
   FROM (centers c
     JOIN profiles p ON ((p.center_id = c.id)))
  WHERE ((c.organisation_id = organisations.id) AND (p.id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM organisation_roles r
  WHERE ((r.organisation_id = organisations.id) AND (r.profile_id = (select auth.uid())) AND (r.revoked_at IS NULL))))));

alter policy "payment_notifications: admissions staff view their centre's" on public.payment_notifications
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "payment_plans: admissions staff view their centre's" on public.payment_plans
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "payment_provider_transactions: admissions staff view their cent" on public.payment_provider_transactions
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "payments: admissions staff view their centre's" on public.payments
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "peer_observation_notes: observer manages their own notes" on public.peer_observation_notes
  using ((observer_id = (select auth.uid())))
  with check ((observer_id = (select auth.uid())));

alter policy "peer_observation_notes: trainer/admin manage notes in their cou" on public.peer_observation_notes
  using ((((select is_trainer()) OR (select is_admin())) AND (EXISTS ( SELECT 1
   FROM peer_observation_sheets s
  WHERE ((s.id = peer_observation_notes.sheet_id) AND (s.course_id = (select current_course_id())))))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (EXISTS ( SELECT 1
   FROM peer_observation_sheets s
  WHERE ((s.id = peer_observation_notes.sheet_id) AND (s.course_id = (select current_course_id())))))));

alter policy "peer_observation_sheets: candidate reads their own once reveale" on public.peer_observation_sheets
  using (((trainee_id = (select auth.uid())) AND (revealed_at IS NOT NULL)));

alter policy "peer_observation_sheets: trainer/admin manage sheets in their c" on public.peer_observation_sheets
  using ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))));

alter policy "plagiarism_scanner_findings: trainer/admin manage findings in t" on public.plagiarism_scanner_findings
  using ((((select is_trainer()) OR (select is_admin())) AND (EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = plagiarism_scanner_findings.assignment_id) AND (a.course_id = (select current_course_id())))))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = plagiarism_scanner_findings.assignment_id) AND (a.course_id = (select current_course_id())))))));

alter policy "plan_assignments: admin manages assignments in their center" on public.plan_assignments
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "plan_assignments: trainee reads their own assignments" on public.plan_assignments
  using ((trainee_id = (select auth.uid())));

alter policy "plan_assignments: trainer manages assignments in their course" on public.plan_assignments
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "platform_owner_access_log: centre-roles holders read their own " on public.platform_owner_access_log
  using ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.profile_id = (select auth.uid())) AND (r.center_id = platform_owner_access_log.center_id) AND (r.revoked_at IS NULL)))));

alter policy "platform_owner_invites: centre-roles holders manage their own c" on public.platform_owner_invites
  using ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.profile_id = (select auth.uid())) AND (r.center_id = platform_owner_invites.center_id) AND (r.revoked_at IS NULL)))))
  with check ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.profile_id = (select auth.uid())) AND (r.center_id = platform_owner_invites.center_id) AND (r.revoked_at IS NULL)))));

alter policy "platform_support_grant_activity: an MCT reads their own course'" on public.platform_support_grant_activity
  using ((EXISTS ( SELECT 1
   FROM (platform_support_grants g
     JOIN course_tutors t ON (((t.course_id = g.course_id) AND (t.tutor_role = 'main_course_tutor'::text) AND (t.left_at IS NULL))))
  WHERE ((g.id = platform_support_grant_activity.grant_id) AND (g.scope = 'course'::text) AND (t.profile_id = (select auth.uid()))))));

alter policy "platform_support_grant_activity: centre-roles holders read thei" on public.platform_support_grant_activity
  using ((EXISTS ( SELECT 1
   FROM (platform_support_grants g
     JOIN centre_roles r ON (((r.center_id = g.center_id) AND (r.revoked_at IS NULL))))
  WHERE ((g.id = platform_support_grant_activity.grant_id) AND (r.profile_id = (select auth.uid()))))));

alter policy "platform_support_grants: an MCT reads their own course's grants" on public.platform_support_grants
  using (((scope = 'course'::text) AND (EXISTS ( SELECT 1
   FROM course_tutors t
  WHERE ((t.course_id = platform_support_grants.course_id) AND (t.profile_id = (select auth.uid())) AND (t.tutor_role = 'main_course_tutor'::text) AND (t.left_at IS NULL))))));

alter policy "platform_support_grants: centre-roles holders read their centre" on public.platform_support_grants
  using ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.profile_id = (select auth.uid())) AND (r.center_id = platform_support_grants.center_id) AND (r.revoked_at IS NULL)))));

alter policy "pre_course_task_items: trainer/admin manage their center's item" on public.pre_course_task_items
  using ((((select is_trainer()) OR (select is_admin())) AND (section_id IN ( SELECT pre_course_task_sections.id
   FROM pre_course_task_sections
  WHERE (pre_course_task_sections.center_id = ANY (held_center_ids()))))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (section_id IN ( SELECT pre_course_task_sections.id
   FROM pre_course_task_sections
  WHERE (pre_course_task_sections.center_id = ANY (held_center_ids()))))));

alter policy "pre_course_task_progress: trainee manages their own progress" on public.pre_course_task_progress
  using ((trainee_id = (select auth.uid())))
  with check ((trainee_id = (select auth.uid())));

alter policy "pre_course_task_progress: trainer reads their course's progress" on public.pre_course_task_progress
  using (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "course staff read responses" on public.pre_course_task_responses
  using ((EXISTS ( SELECT 1
   FROM profiles staff,
    profiles candidate
  WHERE ((staff.id = (select auth.uid())) AND (candidate.id = pre_course_task_responses.trainee_id) AND (staff.role = ANY (ARRAY['trainer'::user_role, 'admin'::user_role, 'platform_owner'::user_role])) AND ((staff.role = ANY (ARRAY['admin'::user_role, 'platform_owner'::user_role])) OR (staff.course_id = candidate.course_id))))));

alter policy "own responses insertable" on public.pre_course_task_responses
  with check ((trainee_id = (select auth.uid())));

alter policy "own responses readable" on public.pre_course_task_responses
  using ((trainee_id = (select auth.uid())));

alter policy "own responses updatable" on public.pre_course_task_responses
  using ((trainee_id = (select auth.uid())))
  with check ((trainee_id = (select auth.uid())));

alter policy "pre_course_task_sections: trainer/admin manage their center's s" on public.pre_course_task_sections
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "profiles: admins can read everyone in their center" on public.profiles
  using (((select is_admin()) AND (center_id = ANY (held_center_ids()))));

alter policy "profiles: admins manage everyone in their center" on public.profiles
  using (((select is_admin()) AND (center_id = ANY (held_center_ids()))))
  with check (((select is_admin()) AND (center_id = ANY (held_center_ids()))));

alter policy "profiles: course members can read trainers on their course" on public.profiles
  using (((role = 'trainer'::user_role) AND (course_id = (select current_course_id()))));

alter policy "profiles: trainers can read trainees in their course" on public.profiles
  using (((select is_trainer()) AND (role = 'trainee'::user_role) AND (course_id = (select current_course_id()))));

alter policy "profiles: users can read their own profile" on public.profiles
  using ((id = (select auth.uid())));

alter policy "profiles: users can update their own onboarding fields" on public.profiles
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

alter policy "resources: trainer/admin manage resources in their center" on public.resources
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "restart_transfers: trainer/admin read their centre's transfers" on public.restart_transfers
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "scavenger_hunt_progress: trainee manages their own progress" on public.scavenger_hunt_progress
  using ((trainee_id = (select auth.uid())))
  with check ((trainee_id = (select auth.uid())));

alter policy "scavenger_hunt_progress: trainer reads their course's progress" on public.scavenger_hunt_progress
  using (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "session_materials: trainer/admin read their course" on public.session_materials
  using ((((select is_admin()) OR (select is_trainer())) AND (course_id = (select current_course_id()))));

alter policy "session_materials: uploader manages their own" on public.session_materials
  using ((uploaded_by = (select auth.uid())))
  with check (((uploaded_by = (select auth.uid())) AND ((course_id = (select current_course_id())) OR (course_id = ( SELECT profiles.course_id
   FROM profiles
  WHERE (profiles.id = (select auth.uid())))))));

alter policy "speaking_task_prompts: centre staff manage their own" on public.speaking_task_prompts
  using (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))))
  with check (((select can_handle_admissions()) AND (center_id = ANY (held_center_ids()))));

alter policy "spreadsheet_imports: only import.run may create" on public.spreadsheet_imports
  with check (((center_id = ANY (held_center_ids())) AND (centre_role_grants_capability('import.run'::text) OR (select is_platform_owner()))));

alter policy "spreadsheet_imports: only import.run may update" on public.spreadsheet_imports
  using (((center_id = ANY (held_center_ids())) AND (centre_role_grants_capability('import.run'::text) OR (select is_platform_owner()))));

alter policy "spreadsheet_imports: the centre's admin family can read them" on public.spreadsheet_imports
  using (((center_id = ANY (held_center_ids())) AND ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.profile_id = (select auth.uid())) AND (r.revoked_at IS NULL) AND (r.center_id = ANY (held_center_ids()))))) OR (select is_platform_owner()))));

alter policy "staff_messages: admins can send in course_admin channels" on public.staff_messages
  with check (((sender_id = (select auth.uid())) AND (select is_admin()) AND (EXISTS ( SELECT 1
   FROM (staff_channel_members m
     JOIN staff_channels sc ON ((sc.id = m.channel_id)))
  WHERE ((m.channel_id = staff_messages.channel_id) AND (m.profile_id = (select auth.uid())) AND (sc.type = 'course_admin'::staff_channel_type))))));

alter policy "staff_messages: members can send messages in their channels" on public.staff_messages
  with check (((sender_id = (select auth.uid())) AND ((select is_trainer()) OR (select is_trainee())) AND (EXISTS ( SELECT 1
   FROM staff_channel_members m
  WHERE ((m.channel_id = staff_messages.channel_id) AND (m.profile_id = (select auth.uid())))))));

alter policy "stage2_tutorial_blocks: admin manages blocks in their center" on public.stage2_tutorial_blocks
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "stage2_tutorial_blocks: trainee reads their own group's blocks" on public.stage2_tutorial_blocks
  using ((((subgroup_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM course_subgroup_members m
  WHERE ((m.subgroup_id = stage2_tutorial_blocks.subgroup_id) AND (m.trainee_id = (select auth.uid())))))) OR ((tp_group_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (course_subgroup_members m
     JOIN course_subgroups g ON ((g.id = m.subgroup_id)))
  WHERE ((g.tp_group_id = stage2_tutorial_blocks.tp_group_id) AND (m.trainee_id = (select auth.uid()))))))));

alter policy "stage2_tutorial_blocks: trainer manages blocks in their course" on public.stage2_tutorial_blocks
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "stage2_tutorial_slots: admin manages slots in their center" on public.stage2_tutorial_slots
  using (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (stage2_tutorial_blocks b
     JOIN courses c ON ((c.id = b.course_id)))
  WHERE ((b.id = stage2_tutorial_slots.block_id) AND (c.center_id = ANY (held_center_ids())))))))
  with check (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (stage2_tutorial_blocks b
     JOIN courses c ON ((c.id = b.course_id)))
  WHERE ((b.id = stage2_tutorial_slots.block_id) AND (c.center_id = ANY (held_center_ids())))))));

alter policy "stage2_tutorial_slots: trainee books or releases their own slot" on public.stage2_tutorial_slots
  using ((((trainee_id IS NULL) OR (trainee_id = (select auth.uid()))) AND (EXISTS ( SELECT 1
   FROM stage2_tutorial_blocks b
  WHERE ((b.id = stage2_tutorial_slots.block_id) AND (((b.subgroup_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM course_subgroup_members m
          WHERE ((m.subgroup_id = b.subgroup_id) AND (m.trainee_id = (select auth.uid())))))) OR ((b.tp_group_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM (course_subgroup_members m
             JOIN course_subgroups g ON ((g.id = m.subgroup_id)))
          WHERE ((g.tp_group_id = b.tp_group_id) AND (m.trainee_id = (select auth.uid()))))))))))))
  with check (((trainee_id IS NULL) OR (trainee_id = (select auth.uid()))));

alter policy "stage2_tutorial_slots: trainee reads slots in their own group" on public.stage2_tutorial_slots
  using ((EXISTS ( SELECT 1
   FROM stage2_tutorial_blocks b
  WHERE ((b.id = stage2_tutorial_slots.block_id) AND (((b.subgroup_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM course_subgroup_members m
          WHERE ((m.subgroup_id = b.subgroup_id) AND (m.trainee_id = (select auth.uid())))))) OR ((b.tp_group_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM (course_subgroup_members m
             JOIN course_subgroups g ON ((g.id = m.subgroup_id)))
          WHERE ((g.tp_group_id = b.tp_group_id) AND (m.trainee_id = (select auth.uid())))))))))));

alter policy "stage2_tutorial_slots: trainer manages slots in their course" on public.stage2_tutorial_slots
  using (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM stage2_tutorial_blocks b
  WHERE ((b.id = stage2_tutorial_slots.block_id) AND (b.course_id = (select current_course_id())))))))
  with check (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM stage2_tutorial_blocks b
  WHERE ((b.id = stage2_tutorial_slots.block_id) AND (b.course_id = (select current_course_id())))))));

alter policy "submission_text_fingerprints: trainer/admin read their centre's" on public.submission_text_fingerprints
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "supervised_session_completions: trainee manages their own" on public.supervised_session_completions
  using ((trainee_id = (select auth.uid())))
  with check ((trainee_id = (select auth.uid())));

alter policy "supervised_session_completions: trainer/admin manage rows in th" on public.supervised_session_completions
  using ((((select is_trainer()) OR (select is_admin())) AND (EXISTS ( SELECT 1
   FROM course_timetable_events e
  WHERE ((e.id = supervised_session_completions.timetable_event_id) AND (e.course_id = (select current_course_id())))))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (EXISTS ( SELECT 1
   FROM course_timetable_events e
  WHERE ((e.id = supervised_session_completions.timetable_event_id) AND (e.course_id = (select current_course_id())))))));

alter policy "support_messages: platform owner only" on public.support_messages
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = 'platform_owner'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = 'platform_owner'::user_role)))));

alter policy "syllabus_planning_entries: admin manages entries in their cente" on public.syllabus_planning_entries
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "syllabus_planning_entries: admin reads entries in their center" on public.syllabus_planning_entries
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "syllabus_planning_entries: cohort reads their course's entries" on public.syllabus_planning_entries
  using ((course_id = (select current_course_id())));

alter policy "syllabus_planning_entries: trainee manages their own entry" on public.syllabus_planning_entries
  using ((trainee_id = (select auth.uid())))
  with check (((trainee_id = (select auth.uid())) AND (course_id = (select current_course_id()))));

alter policy "syllabus_planning_entries: trainer manages entries in their cou" on public.syllabus_planning_entries
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "tit_access_grants: MCT grants" on public.tit_access_grants
  with check (((granted_by_profile_id = (select auth.uid())) AND (revoked_at IS NULL) AND (tit_is_mct_for_course_tutor(course_tutors_id) OR (EXISTS ( SELECT 1
   FROM ((course_tutors ct
     JOIN courses c ON ((c.id = ct.course_id)))
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((ct.id = tit_access_grants.course_tutors_id) AND (p.role = ANY (ARRAY['admin'::user_role, 'platform_owner'::user_role])) AND (p.center_id = c.center_id)))))));

alter policy "tit_access_grants: MCT revokes" on public.tit_access_grants
  using (((revoked_at IS NULL) AND (tit_is_mct_for_course_tutor(course_tutors_id) OR (EXISTS ( SELECT 1
   FROM ((course_tutors ct
     JOIN courses c ON ((c.id = ct.course_id)))
     JOIN profiles p ON ((p.id = (select auth.uid()))))
  WHERE ((ct.id = tit_access_grants.course_tutors_id) AND (p.role = ANY (ARRAY['admin'::user_role, 'platform_owner'::user_role])) AND (p.center_id = c.center_id)))))))
  with check ((revoked_by_profile_id = (select auth.uid())));

alter policy "tit_access_grants: readable by everyone on the record" on public.tit_access_grants
  using ((tit_can_access_course_tutor(course_tutors_id) OR (grantee_profile_id = (select auth.uid()))));

alter policy "tp_audio_library: trainer/admin manage their center's audio" on public.tp_audio_library
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "tp_capture_notes: trainer/admin manage notes in their course" on public.tp_capture_notes
  using ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))));

alter policy "tp_coursebook_sources: trainer/admin manage their center's sour" on public.tp_coursebook_sources
  using ((((select is_trainer()) OR (select is_admin())) AND (EXISTS ( SELECT 1
   FROM tp_coursebooks c
  WHERE ((c.id = tp_coursebook_sources.tp_coursebook_id) AND (c.center_id = ANY (held_center_ids())))))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (EXISTS ( SELECT 1
   FROM tp_coursebooks c
  WHERE ((c.id = tp_coursebook_sources.tp_coursebook_id) AND (c.center_id = ANY (held_center_ids())))))));

alter policy "tp_coursebooks: trainer/admin manage their center's coursebooks" on public.tp_coursebooks
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "tp_feedback: admin manages in their center" on public.tp_feedback
  using (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_feedback.tp_plan_id) AND (c.center_id = ANY (held_center_ids())))))))
  with check (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_feedback.tp_plan_id) AND (c.center_id = ANY (held_center_ids())))))));

alter policy "tp_feedback: trainee reads once self-eval and feedback are both" on public.tp_feedback
  using (((trainee_id = (select auth.uid())) AND (submitted_at IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM tp_self_evaluations se
  WHERE ((se.tp_plan_id = tp_feedback.tp_plan_id) AND (se.submitted_at IS NOT NULL))))));

alter policy "tp_feedback: trainer manages in their course" on public.tp_feedback
  using (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM tp_plans p
  WHERE ((p.id = tp_feedback.tp_plan_id) AND (p.course_id = (select current_course_id())))))))
  with check (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM tp_plans p
  WHERE ((p.id = tp_feedback.tp_plan_id) AND (p.course_id = (select current_course_id())))))));

alter policy "tp_language_analyses: admin manages in their center" on public.tp_language_analyses
  using (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_language_analyses.tp_plan_id) AND (c.center_id = ANY (held_center_ids())))))))
  with check (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_language_analyses.tp_plan_id) AND (c.center_id = ANY (held_center_ids())))))));

alter policy "tp_language_analyses: trainee reads their own" on public.tp_language_analyses
  using ((trainee_id = (select auth.uid())));

alter policy "tp_language_analyses: trainee writes their own while plan unsub" on public.tp_language_analyses
  using (((trainee_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM tp_plans p
  WHERE ((p.id = tp_language_analyses.tp_plan_id) AND (p.submitted_at IS NULL))))))
  with check (((trainee_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM tp_plans p
  WHERE ((p.id = tp_language_analyses.tp_plan_id) AND (p.submitted_at IS NULL))))));

alter policy "tp_language_analyses: trainer manages in their course" on public.tp_language_analyses
  using (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM tp_plans p
  WHERE ((p.id = tp_language_analyses.tp_plan_id) AND (p.course_id = (select current_course_id())))))))
  with check (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM tp_plans p
  WHERE ((p.id = tp_language_analyses.tp_plan_id) AND (p.course_id = (select current_course_id())))))));

alter policy "tp_lesson_criteria_tags: admin manages tags in their center" on public.tp_lesson_criteria_tags
  using (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (tp_lessons l
     JOIN courses c ON ((c.id = l.course_id)))
  WHERE ((l.id = tp_lesson_criteria_tags.tp_lesson_id) AND (c.center_id = ANY (held_center_ids())))))))
  with check (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (tp_lessons l
     JOIN courses c ON ((c.id = l.course_id)))
  WHERE ((l.id = tp_lesson_criteria_tags.tp_lesson_id) AND (c.center_id = ANY (held_center_ids())))))));

alter policy "tp_lesson_criteria_tags: trainee can read tags on their own les" on public.tp_lesson_criteria_tags
  using ((EXISTS ( SELECT 1
   FROM tp_lessons l
  WHERE ((l.id = tp_lesson_criteria_tags.tp_lesson_id) AND (l.trainee_id = (select auth.uid()))))));

alter policy "tp_lesson_criteria_tags: trainer manages tags in their course" on public.tp_lesson_criteria_tags
  using (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM tp_lessons l
  WHERE ((l.id = tp_lesson_criteria_tags.tp_lesson_id) AND (l.course_id = (select current_course_id())))))))
  with check (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM tp_lessons l
  WHERE ((l.id = tp_lesson_criteria_tags.tp_lesson_id) AND (l.course_id = (select current_course_id())))))));

alter policy "tp_lessons: admin manages lessons in their center" on public.tp_lessons
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "tp_lessons: trainee can read their own lessons" on public.tp_lessons
  using ((trainee_id = (select auth.uid())));

alter policy "tp_lessons: trainer manages lessons in their course" on public.tp_lessons
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "tp_material_pool_claims: cohort reads their course's claims" on public.tp_material_pool_claims
  using ((course_id = (select current_course_id())));

alter policy "tp_material_pool_claims: trainee manages their own claim" on public.tp_material_pool_claims
  using (((trainee_id = (select auth.uid())) AND (course_id = (select current_course_id()))))
  with check (((trainee_id = (select auth.uid())) AND (course_id = (select current_course_id()))));

alter policy "tp_material_pool_claims: trainer/admin manage their course's cl" on public.tp_material_pool_claims
  using ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))));

alter policy "tp_materials: admin manages in their center" on public.tp_materials
  using (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_materials.tp_plan_id) AND (c.center_id = ANY (held_center_ids())))))))
  with check (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_materials.tp_plan_id) AND (c.center_id = ANY (held_center_ids())))))));

alter policy "tp_materials: trainee manages their own while plan unsubmitted" on public.tp_materials
  using (((trainee_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM tp_plans p
  WHERE ((p.id = tp_materials.tp_plan_id) AND (p.submitted_at IS NULL))))))
  with check (((trainee_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM tp_plans p
  WHERE ((p.id = tp_materials.tp_plan_id) AND (p.submitted_at IS NULL))))));

alter policy "tp_materials: trainee reads their own" on public.tp_materials
  using ((trainee_id = (select auth.uid())));

alter policy "tp_materials: trainer manages in their course" on public.tp_materials
  using (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM tp_plans p
  WHERE ((p.id = tp_materials.tp_plan_id) AND (p.course_id = (select current_course_id())))))))
  with check (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM tp_plans p
  WHERE ((p.id = tp_materials.tp_plan_id) AND (p.course_id = (select current_course_id())))))));

alter policy "tp_plans: admin manages plans in their center" on public.tp_plans
  using (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check (((select is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "tp_plans: trainee inserts their own draft plans" on public.tp_plans
  with check ((trainee_id = (select auth.uid())));

alter policy "tp_plans: trainee reads their own plans" on public.tp_plans
  using ((trainee_id = (select auth.uid())));

alter policy "tp_plans: trainee updates their own plans while unsubmitted" on public.tp_plans
  using (((trainee_id = (select auth.uid())) AND (submitted_at IS NULL)))
  with check ((trainee_id = (select auth.uid())));

alter policy "tp_plans: trainer manages plans in their course" on public.tp_plans
  using (((select is_trainer()) AND (course_id = (select current_course_id()))))
  with check (((select is_trainer()) AND (course_id = (select current_course_id()))));

alter policy "tp_points: trainer/admin manage their center's tp points" on public.tp_points
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "tp_self_evaluations: admin manages in their center" on public.tp_self_evaluations
  using (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_self_evaluations.tp_plan_id) AND (c.center_id = ANY (held_center_ids())))))))
  with check (((select is_admin()) AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_self_evaluations.tp_plan_id) AND (c.center_id = ANY (held_center_ids())))))));

alter policy "tp_self_evaluations: trainee inserts their own once taught" on public.tp_self_evaluations
  with check (((trainee_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM plan_assignments pa
  WHERE ((pa.trainee_id = tp_self_evaluations.trainee_id) AND (pa.tp_number = tp_self_evaluations.tp_number) AND (pa.taught_at IS NOT NULL))))));

alter policy "tp_self_evaluations: trainee reads their own" on public.tp_self_evaluations
  using ((trainee_id = (select auth.uid())));

alter policy "tp_self_evaluations: trainee updates their own while unsubmitte" on public.tp_self_evaluations
  using (((trainee_id = (select auth.uid())) AND (submitted_at IS NULL)))
  with check ((trainee_id = (select auth.uid())));

alter policy "tp_self_evaluations: trainer manages in their course" on public.tp_self_evaluations
  using (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM tp_plans p
  WHERE ((p.id = tp_self_evaluations.tp_plan_id) AND (p.course_id = (select current_course_id())))))))
  with check (((select is_trainer()) AND (EXISTS ( SELECT 1
   FROM tp_plans p
  WHERE ((p.id = tp_self_evaluations.tp_plan_id) AND (p.course_id = (select current_course_id())))))));

alter policy "tp_video_library: trainer/admin manage their center's videos" on public.tp_video_library
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "volunteer_attendance: trainer/admin manage their course" on public.volunteer_attendance
  using ((((select is_trainer()) OR (select is_admin())) AND (volunteer_student_id IN ( SELECT volunteer_students.id
   FROM volunteer_students
  WHERE (volunteer_students.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = ANY (held_center_ids()))))))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (volunteer_student_id IN ( SELECT volunteer_students.id
   FROM volunteer_students
  WHERE (volunteer_students.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = ANY (held_center_ids()))))))));

alter policy "volunteer_declines: admin reads their center's declines" on public.volunteer_declines
  using (((select is_admin()) AND (volunteer_student_id IN ( SELECT volunteer_students.id
   FROM volunteer_students
  WHERE (volunteer_students.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = ANY (held_center_ids()))))))));

alter policy "volunteer_declines: trainer reads their course's declines" on public.volunteer_declines
  using (((select is_trainer()) AND (volunteer_student_id IN ( SELECT volunteer_students.id
   FROM volunteer_students
  WHERE (volunteer_students.course_id = (select current_course_id()))))));

alter policy "volunteer_people: trainer/admin manage their centre" on public.volunteer_people
  using ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (center_id = ANY (held_center_ids()))));

alter policy "volunteer_shared_materials: trainer/admin manage their course" on public.volunteer_shared_materials
  using ((((select is_trainer()) OR (select is_admin())) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "volunteer_signup_profiles: trainees view after divergence sessi" on public.volunteer_signup_profiles
  using ((("current_role"() = 'trainee'::user_role) AND (course_id = (select current_course_id())) AND fol_divergence_session_reached(course_id)));

alter policy "volunteer_signup_profiles: trainer/admin manage their course" on public.volunteer_signup_profiles
  using ((((select is_admin()) OR (select is_trainer())) AND (course_id = (select current_course_id()))))
  with check ((((select is_admin()) OR (select is_trainer())) AND (course_id = (select current_course_id()))));

alter policy "volunteer_students: trainees view their course's register" on public.volunteer_students
  using ((("current_role"() = 'trainee'::user_role) AND (course_id = (select current_course_id()))));

alter policy "volunteer_students: trainer/admin manage their course" on public.volunteer_students
  using ((((select is_trainer()) OR (select is_admin())) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = ANY (held_center_ids()))))));

alter policy "withdrawal_requests: trainee manages their own" on public.withdrawal_requests
  using ((trainee_id = (select auth.uid())))
  with check ((trainee_id = (select auth.uid())));

alter policy "withdrawal_requests: trainer/admin read and action requests on " on public.withdrawal_requests
  using ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (course_id = (select current_course_id()))));

alter policy "zoom_unmatched_participants: trainer/admin manage their course" on public.zoom_unmatched_participants
  using ((((select is_trainer()) OR (select is_admin())) AND (timetable_event_id IN ( SELECT course_timetable_events.id
   FROM course_timetable_events
  WHERE (course_timetable_events.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = ANY (held_center_ids()))))))))
  with check ((((select is_trainer()) OR (select is_admin())) AND (timetable_event_id IN ( SELECT course_timetable_events.id
   FROM course_timetable_events
  WHERE (course_timetable_events.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = ANY (held_center_ids()))))))));

alter policy "applicant-speaking-task-audio: admissions staff read their cent" on storage.objects
  using (((bucket_id = 'applicant-speaking-task-audio'::text) AND (select can_handle_admissions()) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))));

alter policy "assignment-briefs: trainer/admin manage their center's briefs" on storage.objects
  using (((bucket_id = 'assignment-briefs'::text) AND ((select is_trainer()) OR (select is_admin())) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))))
  with check (((bucket_id = 'assignment-briefs'::text) AND ((select is_trainer()) OR (select is_admin())) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))));

alter policy "coursebook-pdfs: trainer/admin manage their center's PDFs" on storage.objects
  using (((bucket_id = 'coursebook-pdfs'::text) AND ((select is_trainer()) OR (select is_admin())) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))))
  with check (((bucket_id = 'coursebook-pdfs'::text) AND ((select is_trainer()) OR (select is_admin())) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))));

alter policy "resource-hub-files: trainer/admin manage their center's files" on storage.objects
  using (((bucket_id = 'resource-hub-files'::text) AND ((select is_trainer()) OR (select is_admin())) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))))
  with check (((bucket_id = 'resource-hub-files'::text) AND ((select is_trainer()) OR (select is_admin())) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))));

alter policy "special-consideration-evidence: staff read their centre's" on storage.objects
  using (((bucket_id = 'special-consideration-evidence'::text) AND ((select is_trainer()) OR (select is_admin())) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))));

alter policy "tp-audio: trainer/admin manage their center's audio files" on storage.objects
  using (((bucket_id = 'tp-audio'::text) AND ((select is_trainer()) OR (select is_admin())) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))))
  with check (((bucket_id = 'tp-audio'::text) AND ((select is_trainer()) OR (select is_admin())) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))));

alter policy "tp-materials: trainee manages their own files" on storage.objects
  using (((bucket_id = 'tp-materials'::text) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text())) AND ((storage.foldername(name))[2] = ((select auth.uid()))::text)))
  with check (((bucket_id = 'tp-materials'::text) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text())) AND ((storage.foldername(name))[2] = ((select auth.uid()))::text)));

alter policy "tp-materials: trainer/admin manage their center's files" on storage.objects
  using (((bucket_id = 'tp-materials'::text) AND ((select is_trainer()) OR (select is_admin())) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))))
  with check (((bucket_id = 'tp-materials'::text) AND ((select is_trainer()) OR (select is_admin())) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))));

alter policy "volunteer-signup-audio: trainer/admin read their centre's" on storage.objects
  using (((bucket_id = 'volunteer-signup-audio'::text) AND ((select is_trainer()) OR (select is_admin())) AND ((storage.foldername(name))[1] = ANY (held_center_ids_text()))));
