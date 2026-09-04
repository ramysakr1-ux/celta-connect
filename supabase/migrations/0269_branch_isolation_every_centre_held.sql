-- Centre isolation means every branch this person holds, not one of them.
--
-- Ramy, 2 Sep 2026, on the branch-scope work: the app now scopes Admissions
-- and Course Admin to "every branch I hold" itself, through the admin
-- client, because the database rule could only say "my one centre"
-- (current_center_id(): the active branch, else the home branch). So the
-- database had stopped guaranteeing anything for those pages -- it trusted
-- whatever list of centres the code passed. "Once and for all": put the
-- guarantee back underneath.
--
-- held_center_ids() is the set current_center_id() chooses one member of:
-- the home centre, every centre with a live centre_roles grant, and -- for
-- a platform owner -- the invited centre currently entered. Every policy
-- that said `x = current_center_id()` now says `x = any(held_center_ids())`.
-- 108 policies across 85 tables, rewritten mechanically from the live
-- definitions on 5 Sep 2026 (scripts/rls/generate-branch-policies.mjs
-- regenerates it; the -- DOWN file restores the originals).
--
-- current_center_id() itself is untouched: settings screens and anything
-- that must mean "this one branch" still use it, and the app keeps
-- narrowing to the selected branch where a screen should show one.
--
-- Not named my_center_ids(): a function of that name already exists on the
-- live database (SETOF uuid, created outside this repo, used by no policy)
-- with a wider platform-owner branch -- every live invite, entered or not.
-- held_center_ids() mirrors current_center_id() and the app's
-- availableCenterIds exactly: an invited centre counts only while it is
-- the one currently entered.

create or replace function public.held_center_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct c), '{}'::uuid[])
  from (
    select p.center_id as c
    from public.profiles p
    where p.id = auth.uid() and p.center_id is not null
    union
    select r.center_id
    from public.centre_roles r
    where r.profile_id = auth.uid() and r.revoked_at is null
    union
    select p.active_center_id
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'platform_owner'
      and p.active_center_id is not null
      and exists (
        select 1 from public.platform_owner_invites i
        where i.center_id = p.active_center_id and i.revoked_at is null
      )
  ) s;
$$;

comment on function public.held_center_ids() is
  'Every centre the caller holds: home centre, live centre_roles grants, and (platform owner) the invited centre currently entered. The set current_center_id() picks one member of.';

alter policy "admissions_notifications: admissions staff insert their centre'" on public.admissions_notifications
  with check ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "admissions_notifications: admissions staff read their centre's" on public.admissions_notifications
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "applicant_emails: admissions staff read their centre's" on public.applicant_emails
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "applicants: admissions staff handle their centre's" on public.applicants
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "applicants: deciders update their centre's" on public.applicants
  using ((can_decide_admissions() AND (center_id = any(public.held_center_ids()))))
  with check ((can_decide_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "application_links: admissions staff manage their centre's" on public.application_links
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))))
  with check ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "application_writing_prompts: admissions staff manage their cent" on public.application_writing_prompts
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))))
  with check ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "assignment_section_responses: admin manages in their center" on public.assignment_section_responses
  using ((is_admin() AND (EXISTS ( SELECT 1
   FROM (assignments a
     JOIN courses c ON ((c.id = a.course_id)))
  WHERE ((a.id = assignment_section_responses.assignment_id) AND (c.center_id = any(public.held_center_ids())))))))
  with check ((is_admin() AND (EXISTS ( SELECT 1
   FROM (assignments a
     JOIN courses c ON ((c.id = a.course_id)))
  WHERE ((a.id = assignment_section_responses.assignment_id) AND (c.center_id = any(public.held_center_ids())))))));

alter policy "assignment_templates: trainee reads published templates in thei" on public.assignment_templates
  using (((published_at IS NOT NULL) AND (center_id = any(public.held_center_ids()))));

alter policy "assignment_templates: trainer/admin manage their center's templ" on public.assignment_templates
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))))
  with check (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "assignment_type_definitions: admin manages their center's own t" on public.assignment_type_definitions
  using ((is_admin() AND (center_id = any(public.held_center_ids()))))
  with check ((is_admin() AND (center_id = any(public.held_center_ids()))));

alter policy "assignment_type_definitions: everyone in the center reads the s" on public.assignment_type_definitions
  using (((center_id IS NULL) OR (center_id = any(public.held_center_ids()))));

alter policy "assignments: admin manages assignments in their center" on public.assignments
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "attendance_absences: admin manages absences in their center" on public.attendance_absences
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "branch_referral_requests: admissions staff read their centre's" on public.branch_referral_requests
  using ((can_handle_admissions() AND ((from_center_id = any(public.held_center_ids())) OR (to_center_id = any(public.held_center_ids())))));

alter policy "cambridge_documents: same centre or same organisation can read" on public.cambridge_documents
  using (((center_id = any(public.held_center_ids())) OR (organisation_id = ( SELECT c.organisation_id
   FROM centers c
  WHERE (c.id = any(public.held_center_ids()))))));

alter policy "celta5_matrix: admin can edit matrix granted at edit level" on public.celta5_matrix
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids())))) AND (EXISTS ( SELECT 1
   FROM celta5_records r
  WHERE ((r.trainee_id = celta5_matrix.trainee_id) AND (r.admin_access_granted_at IS NOT NULL) AND (r.admin_access_level = 'edit'::text))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids())))) AND (EXISTS ( SELECT 1
   FROM celta5_records r
  WHERE ((r.trainee_id = celta5_matrix.trainee_id) AND (r.admin_access_granted_at IS NOT NULL) AND (r.admin_access_level = 'edit'::text))))));

alter policy "celta5_matrix: admin can read granted matrix" on public.celta5_matrix
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids())))) AND (EXISTS ( SELECT 1
   FROM celta5_records r
  WHERE ((r.trainee_id = celta5_matrix.trainee_id) AND (r.admin_access_granted_at IS NOT NULL))))));

alter policy "celta5_records: admin can edit records granted at edit level" on public.celta5_records
  using ((is_admin() AND (admin_access_granted_at IS NOT NULL) AND (admin_access_level = 'edit'::text) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (admin_access_granted_at IS NOT NULL) AND (admin_access_level = 'edit'::text) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "celta5_records: admin can read granted records" on public.celta5_records
  using ((is_admin() AND (admin_access_granted_at IS NOT NULL) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "centers: admins can update their own center" on public.centers
  using (((id = any(public.held_center_ids())) AND is_admin()));

alter policy "centers: members can read their own center" on public.centers
  using ((id = any(public.held_center_ids())));

alter policy "centre_assignment_criteria: admin manages their centre's criter" on public.centre_assignment_criteria
  using ((is_admin() AND (center_id = any(public.held_center_ids()))))
  with check ((is_admin() AND (center_id = any(public.held_center_ids()))));

alter policy "centre_assignment_criteria: cohort reads their centre's criteri" on public.centre_assignment_criteria
  using ((center_id = any(public.held_center_ids())));

alter policy "concerns: admin manages their center's concerns" on public.concerns
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "course_access_tokens: trainer/admin manage their course" on public.course_access_tokens
  using (((is_trainer() OR is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check (((is_trainer() OR is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "course_broadcasts: admin manages broadcasts in their center" on public.course_broadcasts
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids())))) AND (author_id = auth.uid())));

alter policy "course_broadcasts: admin reads broadcasts in their center" on public.course_broadcasts
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "course_close_outs: admin reads their centre's close-outs" on public.course_close_outs
  using ((is_admin() AND (center_id = any(public.held_center_ids()))));

alter policy "course invitations: centre staff read" on public.course_invitations
  using ((center_id = any(public.held_center_ids())));

alter policy "course_subgroup_members: admin manages members in their center" on public.course_subgroup_members
  using ((is_admin() AND (EXISTS ( SELECT 1
   FROM (course_subgroups g
     JOIN courses c ON ((c.id = g.course_id)))
  WHERE ((g.id = course_subgroup_members.subgroup_id) AND (c.center_id = any(public.held_center_ids())))))))
  with check ((is_admin() AND (EXISTS ( SELECT 1
   FROM (course_subgroups g
     JOIN courses c ON ((c.id = g.course_id)))
  WHERE ((g.id = course_subgroup_members.subgroup_id) AND (c.center_id = any(public.held_center_ids())))))));

alter policy "course_subgroups: admin manages subgroups in their center" on public.course_subgroups
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "course_timetable_events: admin manages timetables in their cent" on public.course_timetable_events
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "course_timetable_events: admin reads timetables in their center" on public.course_timetable_events
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "course_tp_group_tutors: admin in their centre" on public.course_tp_group_tutors
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "course_tp_groups: admin manages tp groups in their center" on public.course_tp_groups
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "course_tp_schedule: admin manages schedule in their center" on public.course_tp_schedule
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "course_tutors: admin manages tutors in their center's courses" on public.course_tutors
  using ((is_admin() AND (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_tutors.course_id) AND (c.center_id = any(public.held_center_ids())))))))
  with check ((is_admin() AND (EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = course_tutors.course_id) AND (c.center_id = any(public.held_center_ids())))))));

alter policy "courses: admins manage courses in their center" on public.courses
  using (((center_id = any(public.held_center_ids())) AND is_admin()))
  with check (((center_id = any(public.held_center_ids())) AND is_admin()));

alter policy "courses: members can read courses in their center" on public.courses
  using ((center_id = any(public.held_center_ids())));

alter policy "deferral_transfers: trainer/admin read their centre's transfers" on public.deferral_transfers
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "email_bounce_tasks: admissions staff read their centre's" on public.email_bounce_tasks
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "feedback_style_examples: trainer/admin manage their center's st" on public.feedback_style_examples
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))))
  with check (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "filmed_observation_breaks: admin manages their center's breaks" on public.filmed_observation_breaks
  using ((is_admin() AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = any(public.held_center_ids()))))))))
  with check ((is_admin() AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = any(public.held_center_ids()))))))));

alter policy "filmed_observation_sessions: admin manages their center's sessi" on public.filmed_observation_sessions
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "filmed_observation_task_responses: admin reads their center's r" on public.filmed_observation_task_responses
  using ((is_admin() AND (task_id IN ( SELECT t.id
   FROM (filmed_observation_tasks t
     JOIN filmed_observation_sessions s ON ((s.id = t.session_id)))
  WHERE (s.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = any(public.held_center_ids()))))))));

alter policy "filmed_observation_tasks: admin manages their center's tasks" on public.filmed_observation_tasks
  using ((is_admin() AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = any(public.held_center_ids()))))))))
  with check ((is_admin() AND (session_id IN ( SELECT filmed_observation_sessions.id
   FROM filmed_observation_sessions
  WHERE (filmed_observation_sessions.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = any(public.held_center_ids()))))))));

alter policy "finances: admins only, scoped to their center" on public.finances
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "formal_letters: admin manages their center's letters" on public.formal_letters
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "individual_tutorial_invites: admin manages invites in their cen" on public.individual_tutorial_invites
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "interview_availability_patterns: admissions staff manage their " on public.interview_availability_patterns
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))))
  with check ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "interview_blocks: admissions staff manage their centre's" on public.interview_blocks
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))))
  with check ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "interview_questions: admissions staff manage their centre's" on public.interview_questions
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))))
  with check ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "interview_records: deciders manage their centre's" on public.interview_records
  using ((can_decide_admissions() AND (EXISTS ( SELECT 1
   FROM applicants a
  WHERE ((a.id = interview_records.applicant_id) AND (a.center_id = any(public.held_center_ids())))))))
  with check ((can_decide_admissions() AND (EXISTS ( SELECT 1
   FROM applicants a
  WHERE ((a.id = interview_records.applicant_id) AND (a.center_id = any(public.held_center_ids())))))));

alter policy "interview_slots: admissions staff manage their centre's" on public.interview_slots
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))))
  with check ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "malpractice_outcome_options: trainer/admin manage their center'" on public.malpractice_outcome_options
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))))
  with check (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "marking_guidance_entries: trainers read and write their centre'" on public.marking_guidance_entries
  using ((is_trainer() AND (center_id = any(public.held_center_ids()))))
  with check ((is_trainer() AND (center_id = any(public.held_center_ids()))));

alter policy "observation_task_submissions: admin reads their center's submis" on public.observation_task_submissions
  using ((is_admin() AND (task_id IN ( SELECT observation_tasks.id
   FROM observation_tasks
  WHERE (observation_tasks.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = any(public.held_center_ids()))))))));

alter policy "observation_tasks: admin manages their center's tasks" on public.observation_tasks
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "observations: admin can read observations in their center" on public.observations
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "payment_notifications: admissions staff view their centre's" on public.payment_notifications
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "payment_plans: admissions staff view their centre's" on public.payment_plans
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "payment_plans: deciders manage their centre's" on public.payment_plans
  using ((can_decide_admissions() AND (center_id = any(public.held_center_ids()))))
  with check ((can_decide_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "payment_provider_transactions: admissions staff view their cent" on public.payment_provider_transactions
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "payments: admissions staff view their centre's" on public.payments
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "payments: deciders manage their centre's" on public.payments
  using ((can_decide_admissions() AND (center_id = any(public.held_center_ids()))))
  with check ((can_decide_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "plan_assignments: admin manages assignments in their center" on public.plan_assignments
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "pre_course_task_items: members can read their center's items" on public.pre_course_task_items
  using ((section_id IN ( SELECT pre_course_task_sections.id
   FROM pre_course_task_sections
  WHERE (pre_course_task_sections.center_id = any(public.held_center_ids())))));

alter policy "pre_course_task_items: trainer/admin manage their center's item" on public.pre_course_task_items
  using (((is_trainer() OR is_admin()) AND (section_id IN ( SELECT pre_course_task_sections.id
   FROM pre_course_task_sections
  WHERE (pre_course_task_sections.center_id = any(public.held_center_ids()))))))
  with check (((is_trainer() OR is_admin()) AND (section_id IN ( SELECT pre_course_task_sections.id
   FROM pre_course_task_sections
  WHERE (pre_course_task_sections.center_id = any(public.held_center_ids()))))));

alter policy "pre_course_task_sections: members can read their center's secti" on public.pre_course_task_sections
  using ((center_id = any(public.held_center_ids())));

alter policy "pre_course_task_sections: trainer/admin manage their center's s" on public.pre_course_task_sections
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))))
  with check (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "profiles: admins can read everyone in their center" on public.profiles
  using ((is_admin() AND (center_id = any(public.held_center_ids()))));

alter policy "profiles: admins manage everyone in their center" on public.profiles
  using ((is_admin() AND (center_id = any(public.held_center_ids()))))
  with check ((is_admin() AND (center_id = any(public.held_center_ids()))));

alter policy "refunds: centre staff read their centre's" on public.refunds
  using ((center_id = any(public.held_center_ids())));

alter policy "resources: members can read resources in their center" on public.resources
  using ((center_id = any(public.held_center_ids())));

alter policy "resources: trainer/admin manage resources in their center" on public.resources
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))))
  with check (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "restart_transfers: trainer/admin read their centre's transfers" on public.restart_transfers
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "speaking_task_prompts: centre staff manage their own" on public.speaking_task_prompts
  using ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))))
  with check ((can_handle_admissions() AND (center_id = any(public.held_center_ids()))));

alter policy "spreadsheet_imports: only import.run may create" on public.spreadsheet_imports
  with check (((center_id = any(public.held_center_ids())) AND (centre_role_grants_capability('import.run'::text) OR is_platform_owner())));

alter policy "spreadsheet_imports: only import.run may update" on public.spreadsheet_imports
  using (((center_id = any(public.held_center_ids())) AND (centre_role_grants_capability('import.run'::text) OR is_platform_owner())));

alter policy "spreadsheet_imports: the centre's admin family can read them" on public.spreadsheet_imports
  using (((center_id = any(public.held_center_ids())) AND ((EXISTS ( SELECT 1
   FROM centre_roles r
  WHERE ((r.profile_id = auth.uid()) AND (r.revoked_at IS NULL) AND (r.center_id = any(public.held_center_ids()))))) OR is_platform_owner())));

alter policy "stage2_tutorial_blocks: admin manages blocks in their center" on public.stage2_tutorial_blocks
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "stage2_tutorial_slots: admin manages slots in their center" on public.stage2_tutorial_slots
  using ((is_admin() AND (EXISTS ( SELECT 1
   FROM (stage2_tutorial_blocks b
     JOIN courses c ON ((c.id = b.course_id)))
  WHERE ((b.id = stage2_tutorial_slots.block_id) AND (c.center_id = any(public.held_center_ids())))))))
  with check ((is_admin() AND (EXISTS ( SELECT 1
   FROM (stage2_tutorial_blocks b
     JOIN courses c ON ((c.id = b.course_id)))
  WHERE ((b.id = stage2_tutorial_slots.block_id) AND (c.center_id = any(public.held_center_ids())))))));

alter policy "submission_text_fingerprints: trainer/admin read their centre's" on public.submission_text_fingerprints
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "syllabus_planning_entries: admin manages entries in their cente" on public.syllabus_planning_entries
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "syllabus_planning_entries: admin reads entries in their center" on public.syllabus_planning_entries
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "tp_audio_library: same-center trainees can read" on public.tp_audio_library
  using ((center_id = any(public.held_center_ids())));

alter policy "tp_audio_library: trainer/admin manage their center's audio" on public.tp_audio_library
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))))
  with check (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "tp_coursebook_sources: trainer/admin manage their center's sour" on public.tp_coursebook_sources
  using (((is_trainer() OR is_admin()) AND (EXISTS ( SELECT 1
   FROM tp_coursebooks c
  WHERE ((c.id = tp_coursebook_sources.tp_coursebook_id) AND (c.center_id = any(public.held_center_ids())))))))
  with check (((is_trainer() OR is_admin()) AND (EXISTS ( SELECT 1
   FROM tp_coursebooks c
  WHERE ((c.id = tp_coursebook_sources.tp_coursebook_id) AND (c.center_id = any(public.held_center_ids())))))));

alter policy "tp_coursebooks: same-center trainees can read" on public.tp_coursebooks
  using ((center_id = any(public.held_center_ids())));

alter policy "tp_coursebooks: trainer/admin manage their center's coursebooks" on public.tp_coursebooks
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))))
  with check (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "tp_feedback: admin manages in their center" on public.tp_feedback
  using ((is_admin() AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_feedback.tp_plan_id) AND (c.center_id = any(public.held_center_ids())))))))
  with check ((is_admin() AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_feedback.tp_plan_id) AND (c.center_id = any(public.held_center_ids())))))));

alter policy "tp_language_analyses: admin manages in their center" on public.tp_language_analyses
  using ((is_admin() AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_language_analyses.tp_plan_id) AND (c.center_id = any(public.held_center_ids())))))))
  with check ((is_admin() AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_language_analyses.tp_plan_id) AND (c.center_id = any(public.held_center_ids())))))));

alter policy "tp_lesson_criteria_tags: admin manages tags in their center" on public.tp_lesson_criteria_tags
  using ((is_admin() AND (EXISTS ( SELECT 1
   FROM (tp_lessons l
     JOIN courses c ON ((c.id = l.course_id)))
  WHERE ((l.id = tp_lesson_criteria_tags.tp_lesson_id) AND (c.center_id = any(public.held_center_ids())))))))
  with check ((is_admin() AND (EXISTS ( SELECT 1
   FROM (tp_lessons l
     JOIN courses c ON ((c.id = l.course_id)))
  WHERE ((l.id = tp_lesson_criteria_tags.tp_lesson_id) AND (c.center_id = any(public.held_center_ids())))))));

alter policy "tp_lessons: admin manages lessons in their center" on public.tp_lessons
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "tp_material_pool_items: baseline or own centre readable" on public.tp_material_pool_items
  using (((center_id IS NULL) OR (center_id = any(public.held_center_ids()))));

alter policy "tp_materials: admin manages in their center" on public.tp_materials
  using ((is_admin() AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_materials.tp_plan_id) AND (c.center_id = any(public.held_center_ids())))))))
  with check ((is_admin() AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_materials.tp_plan_id) AND (c.center_id = any(public.held_center_ids())))))));

alter policy "tp_plans: admin manages plans in their center" on public.tp_plans
  using ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check ((is_admin() AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "tp_points: trainer/admin manage their center's tp points" on public.tp_points
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))))
  with check (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "tp_self_evaluations: admin manages in their center" on public.tp_self_evaluations
  using ((is_admin() AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_self_evaluations.tp_plan_id) AND (c.center_id = any(public.held_center_ids())))))))
  with check ((is_admin() AND (EXISTS ( SELECT 1
   FROM (tp_plans p
     JOIN courses c ON ((c.id = p.course_id)))
  WHERE ((p.id = tp_self_evaluations.tp_plan_id) AND (c.center_id = any(public.held_center_ids())))))));

alter policy "tp_video_library: same-center trainees can read" on public.tp_video_library
  using ((center_id = any(public.held_center_ids())));

alter policy "tp_video_library: trainer/admin manage their center's videos" on public.tp_video_library
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))))
  with check (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "volunteer_attendance: trainer/admin manage their course" on public.volunteer_attendance
  using (((is_trainer() OR is_admin()) AND (volunteer_student_id IN ( SELECT volunteer_students.id
   FROM volunteer_students
  WHERE (volunteer_students.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = any(public.held_center_ids()))))))))
  with check (((is_trainer() OR is_admin()) AND (volunteer_student_id IN ( SELECT volunteer_students.id
   FROM volunteer_students
  WHERE (volunteer_students.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = any(public.held_center_ids()))))))));

alter policy "volunteer_declines: admin reads their center's declines" on public.volunteer_declines
  using ((is_admin() AND (volunteer_student_id IN ( SELECT volunteer_students.id
   FROM volunteer_students
  WHERE (volunteer_students.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = any(public.held_center_ids()))))))));

alter policy "volunteer_people: trainer/admin manage their centre" on public.volunteer_people
  using (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))))
  with check (((is_trainer() OR is_admin()) AND (center_id = any(public.held_center_ids()))));

alter policy "volunteer_shared_materials: trainer/admin manage their course" on public.volunteer_shared_materials
  using (((is_trainer() OR is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check (((is_trainer() OR is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "volunteer_students: trainer/admin manage their course" on public.volunteer_students
  using (((is_trainer() OR is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))))
  with check (((is_trainer() OR is_admin()) AND (course_id IN ( SELECT courses.id
   FROM courses
  WHERE (courses.center_id = any(public.held_center_ids()))))));

alter policy "zoom_unmatched_participants: trainer/admin manage their course" on public.zoom_unmatched_participants
  using (((is_trainer() OR is_admin()) AND (timetable_event_id IN ( SELECT course_timetable_events.id
   FROM course_timetable_events
  WHERE (course_timetable_events.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = any(public.held_center_ids()))))))))
  with check (((is_trainer() OR is_admin()) AND (timetable_event_id IN ( SELECT course_timetable_events.id
   FROM course_timetable_events
  WHERE (course_timetable_events.course_id IN ( SELECT courses.id
           FROM courses
          WHERE (courses.center_id = any(public.held_center_ids()))))))));
