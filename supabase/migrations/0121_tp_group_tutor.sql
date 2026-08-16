-- A TP group's tutor and meeting days.
--
-- Course Admin.dc.html puts both under each group's name -- "Nadia Farouk ·
-- odd days" -- and nothing stored either: course_tp_groups held an id, a
-- course id, a name and a timestamp, and no table anywhere linked a tutor to a
-- group.
--
-- It matters beyond the label. A TP group is the unit a tutor actually owns:
-- they observe it, give its feedback, and sign its candidates' CELTA 5s. "Who
-- has Group ABC" is a question a course administrator answers constantly, and
-- the app could not hold the answer.

alter table public.course_tp_groups
  add column if not exists tutor_profile_id uuid references public.profiles (id) on delete set null;

-- Free text rather than a day-of-week set. The design's own example is "odd
-- days" / "even days", which is a rotation pattern rather than a list of
-- weekdays -- and centres describe this differently ("Mon/Wed/Fri", "odd
-- days", "mornings"). A structured field would force everyone into one
-- vocabulary for something nothing computes against.
alter table public.course_tp_groups
  add column if not exists meeting_days text;

comment on column public.course_tp_groups.tutor_profile_id is
  'The tutor who owns this TP group -- observes it, feeds back on it, signs its CELTA 5s. Null is valid: a group can exist before it is staffed.';
comment on column public.course_tp_groups.meeting_days is
  'How the centre describes when this group teaches. Free text on purpose ("odd days", "Mon/Wed/Fri") -- nothing computes against it.';
