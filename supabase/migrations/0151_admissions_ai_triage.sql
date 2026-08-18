-- specs/for-claude-code-email-inventory.md Part 1, specs/twenty-decisions.md
-- 11a, specs/review-notes.md: "the reading triages into three lanes: clear ->
-- auto-book, mixed/borderline -> human queue, clear problems -> notify a
-- tutor. It never writes a rejection at any confidence." Confirmed with Ramy
-- 2026-08-18: the AI is only ever booking an interview slot for the "clear"
-- lane, never deciding whether a candidate is accepted -- that decision
-- stays with build-spec.md's own AI rule ("AI will only flag it out, and
-- then the trainer would take a look at it and then make a decision", Ramy
-- 2026-08-16), which governs the separate marking_* / task_feedback_ai_suggestion
-- columns already on this table and is untouched by this migration.
--
-- Shadow mode first: a centre can turn on the AI reading itself
-- (admissions_ai_shadow_mode_enabled) without turning on auto-booking
-- (admissions_ai_autobook_enabled) -- the reading is recorded on every
-- applicant either way, but nothing is ever auto-sent until the centre
-- separately enables it, which is why autobook can never be true while
-- shadow mode is off.

alter table public.centers
  add column admissions_ai_shadow_mode_enabled boolean not null default false,
  add column admissions_ai_autobook_enabled boolean not null default false,
  add constraint centers_autobook_requires_shadow_mode
    check (not admissions_ai_autobook_enabled or admissions_ai_shadow_mode_enabled);

alter table public.applicants
  add column ai_reading_lane text check (ai_reading_lane in ('clear', 'borderline', 'clear_problems')),
  -- "A 15-minute hold between verdict and email... it is a cancellation
  -- window with a Hold button in the admin queue." Cleared by a cron once
  -- past due; interview_auto_send_cancelled_at stops it permanently.
  add column interview_auto_send_at timestamptz,
  add column interview_auto_send_cancelled_at timestamptz,
  add column interview_auto_send_cancelled_by uuid references public.profiles (id),
  add column interview_auto_send_sent_at timestamptz,
  -- "Clear problems -> a tutor is notified... in-app flag, not push/email."
  -- A timestamp rather than a boolean so the admissions screen can show how
  -- long it has been waiting, same idiom as every other "sitting since" flag
  -- in this app.
  add column clear_problems_notified_at timestamptz;

create index applicants_interview_auto_send_at_idx on public.applicants (interview_auto_send_at)
  where interview_auto_send_at is not null and interview_auto_send_sent_at is null and interview_auto_send_cancelled_at is null;

-- Same idiom as 0086: idempotent drop-then-recreate of the known
-- deterministic constraint name, extending the existing broadcast-to-the-
-- centre notification feed with the "clear problems" lane rather than
-- building separate per-tutor routing infra. The spec names the MCT as a
-- reasonable default recipient but leaves it open (see
-- for-claude-code-email-inventory.md Part 1) -- the notification message
-- itself names the MCT so it is actionable without inventing a
-- per-user targeting system this app doesn't otherwise have.
alter table public.admissions_notifications drop constraint if exists admissions_notifications_type_check;
alter table public.admissions_notifications
  add constraint admissions_notifications_type_check
  check (type in ('submitted', 'task_returned', 'interview_completed', 'stale_no_decision', 'place_offered', 'clear_problems'));
