-- Undoing a duplicate I created earlier the same day.
--
-- On 6 Sep 2026 I added centers.tint_scheme and course_tutors.tint_nominated_by
-- to record whether a trainer-in-training's work is moderated by the course
-- assessor, having concluded Connect did not hold those facts.
--
-- It already did, and had since 28 August. tit_records.scheme (migration 0148)
-- and tit_records.trains_at_nominating_centre (migration 0234) are exactly
-- these two facts, set on the Trainer-in-Training screen, and
-- workspace.tsx has computed the rule off them as `requiresAssessorDay` ever
-- since:
--
--   titRecord.scheme === "external" || !titRecord.trains_at_nominating_centre
--
-- Two sources of truth for one fact is worse than none: the Assessor tab was
-- reading the empty new columns while the Trainer-in-Training screen read the
-- populated old ones, so the two screens could disagree about whether a centre
-- owed its assessor an extra day.
--
-- The existing pair is also the better grain. A scheme is approved per
-- trainer-in-training, not blanket per centre -- a centre can hold trainers on
-- both schemes at once, which centers.tint_scheme could not express.
--
-- Safe to drop unconditionally: both columns were added and removed within a
-- few hours, the capture forms never shipped to production, and neither column
-- was ever written to on any environment.

alter table public.centers drop column if exists tint_scheme;
alter table public.course_tutors drop column if exists tint_nominated_by;

notify pgrst, 'reload schema';
