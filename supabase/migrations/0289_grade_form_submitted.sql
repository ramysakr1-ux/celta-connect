-- The Centre Grade form, submitted in Appian: recorded at last.
--
-- Administration Handbook June 2025, 14.1 -- 2-3 days before the assessment
-- the centre must "complete the centre grade form in Appian" and "give the
-- assessor the course notification reference number". 15.2 says why the
-- first matters: the assessor's report form "can be accessed once the centre
-- has submitted the grade form". Connect recorded the reference
-- (appian_notification_reference, 0256) and the entry form
-- (entry_form_sent_at) but never this -- the step the assessor's report
-- actually hinges on. So the 14.1 preparation list could not tick it, the
-- pack could not tell the assessor whether their report would open, and
-- the MCT had nowhere to say "done".
--
-- Ramy, 12 Sep 2026: a shared tick, MCT or Course Admin, whoever does it
-- first -- the same shape as the entry form and the assessor contact. The
-- write goes through markGradeFormSubmitted (grade-form-actions.ts), which
-- also logs who did it in management_activity_log.
--
-- Re-runnable.

alter table public.courses
  add column if not exists grade_form_submitted_at timestamptz,
  add column if not exists grade_form_submitted_by uuid references public.profiles (id);

comment on column public.courses.grade_form_submitted_at is
  'When the centre marked the Centre Grade form as submitted in Appian (Administration Handbook 14.1). Null until then.';
comment on column public.courses.grade_form_submitted_by is
  'Who marked it -- the main course tutor or Course Admin.';
