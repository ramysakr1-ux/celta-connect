-- The full set from `All Emails.dc.html` -- nineteen, each with its own
-- trigger, recipient and reply-to. Migration 0108 anticipated two of the
-- missing ones; these are the rest.
--
-- Named by what triggers them rather than by their subject line, so a renamed
-- subject never orphans a log entry.

alter table public.applicant_emails drop constraint if exists applicant_emails_type_check;
alter table public.applicant_emails add constraint applicant_emails_type_check check (type in (
  -- Applying
  'acknowledgement',        -- "We have your application"
  'task_waiting',           -- "Your pre-interview task is ready in Connect"
  'interview_invitation',   -- "Your CELTA interview -- choose a time"
  -- The decision
  'offer',
  'rejection',              -- after the task
  'rejection_after_interview',
  'waiting_list',
  'not_this_time',          -- "The course filled before a place came free"
  'place_freed',
  -- Before the course
  'welcome',                -- "Your CELTA workspace is ready" (deposit cleared)
  'starts_monday',
  'late_enrolment',
  -- Staff and assessor
  'tutor_added',
  'centre_created',
  'interview_booked',
  'reading_flagged',
  'assessor_pack',
  -- Volunteers
  'volunteer_signed_up',
  'volunteer_class_starting'
));

-- Not every one of these goes to an applicant: four go to staff, two to a
-- volunteer. applicant_id was already nullable, but the FK meant a staff email
-- had nowhere to record WHO it went to beyond the address. This keeps the
-- recipient's name for the log without pretending they are an applicant.
alter table public.applicant_emails add column if not exists recipient_name text;
