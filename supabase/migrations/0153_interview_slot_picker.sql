-- Ramy, 2026-08-18: supersedes migration 0151/0152's "auto-book the
-- earliest slot" design for the AI-triage clear lane. Every interview
-- invite -- auto-sent after the clear lane's 15-minute hold, or sent by a
-- human for the borderline lane -- now carries the SAME applicant-facing
-- picker link into the centre's open interview_slots pool. The applicant
-- always chooses their own time; nothing is booked on their behalf. This
-- also finally gives interviewInvitationEmailHtml's bookingUrl a real
-- destination -- it existed since Applications.dc.html but had nowhere to
-- point until this page.
--
-- interview_auto_send_at/_cancelled_at/_cancelled_by/_sent_at (0151) are
-- untouched -- they still govern the clear lane's 15-minute hold
-- specifically. interview_invite_sent_at is new and general: set whenever
-- ANY invite goes out, either lane, so the 48-hour reminder and "already
-- invited" checks don't care which lane sent it.

alter table public.applicants
  add column interview_invite_token uuid unique default gen_random_uuid(),
  add column interview_invite_sent_at timestamptz,
  add column interview_invite_reminder_sent_at timestamptz;

-- "A flag that will not clear... until slots exist" (Interview
-- Availability.dc.html) -- reuses the same admissions_notifications feed
-- as 0151's clear_problems lane rather than building a separate live-
-- clearing dashboard counter; an admissions handler sees it in the same
-- place they see every other pipeline flag.
alter table public.admissions_notifications drop constraint if exists admissions_notifications_type_check;
alter table public.admissions_notifications
  add constraint admissions_notifications_type_check
  check (type in ('submitted', 'task_returned', 'interview_completed', 'stale_no_decision', 'place_offered', 'clear_problems', 'no_interview_slots'));
