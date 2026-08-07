-- Checkpoint 8 (Grades Report), area 4. The design reference's "In order to
-- deserve a [grade], they need to..." box -- a tutor's free-text working
-- note on what a candidate needs to show to earn a higher provisional band.
-- Same simple shape as every other tutor-notes column on this table
-- (overall_notes, grade_review_tutor_comments): one text field, one line
-- per condition, rendered as bullets.
--
-- Explicitly NOT shown to the candidate until the final report is released
-- (release-final-report-form.tsx already gates final_report_released_at) --
-- the design's own note: "Shown to the candidate only after the final
-- report is released -- this is the tutors' working note." Enforced at the
-- UI layer (same as the rest of this table's grade fields), not a new RLS
-- rule -- celta5_records has no trainee-self SELECT policy at all (a
-- trainee only ever reads it through get_my_celta5_record(), which this
-- column simply isn't added to).

alter table public.celta5_records
  add column provisional_upgrade_conditions text;
