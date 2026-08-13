-- specs/build-spec.md §3 "Leaving the course" + §4 "entry_form_sent_at".
-- Phase 1 of that section: the shared status scaffolding plus Withdrawal,
-- the one case that's entirely single-course and fully specified. Deferral
-- / first-half-restart / extension reuse `course_status` but add their own
-- fields in later migrations once each is actually built.

-- §4: one field, four behaviours (name lock, cohort lock, withdrawal
-- reportability, and the one date that comes from Cambridge's calendar
-- rather than the timetable). Nothing else in this migration reads it yet
-- except withdrawal reportability below.
alter table public.courses add column entry_form_sent_at timestamptz;

-- §3: a trainee's course-leaving status. 'active' is the default and by far
-- the common case. The other four values are named directly in the spec;
-- 'deferred'/'restarting'/'extension' aren't wired to anything yet -- only
-- 'withdrawn' has real behaviour in this migration's phase.
alter table public.profiles add column course_status text not null default 'active'
  check (course_status in ('active', 'withdrawn', 'deferred', 'restarting', 'extension'));
alter table public.profiles add column course_status_set_at timestamptz;
alter table public.profiles add column course_status_set_by uuid references public.profiles(id);
-- Free-text reason/note captured with the status change. Not required for
-- every status (withdrawal doesn't need one), but deferral's hours-carried
-- override will require it in a later phase -- kept generic and nullable
-- here since this phase doesn't enforce that yet.
alter table public.profiles add column course_status_note text;

-- Withdrawal-specific. "Withdraw before entry_form_sent_at: Cambridge never
-- sees them, internal event only. Withdraw after: they appear in
-- provisional and final grades with outcome Withdrawn." Computed once at
-- the moment of withdrawal from whether the course's entry_form_sent_at was
-- already set -- not re-derived later, since entry_form_sent_at could in
-- theory be set afterward and that must not retroactively change history.
alter table public.profiles add column withdrawal_reportable boolean;
-- "Requires a signed letter (the app generates it)" -- tracks that the
-- letter has been generated at least once, for display ("Generated on ...")
-- rather than gating whether it CAN be downloaded again.
alter table public.profiles add column withdrawal_letter_generated_at timestamptz;

-- No RLS policy changes needed: profiles already restricts row updates to
-- the app's action layer pattern used throughout this codebase (server
-- actions call requireRole(["trainer","admin"]) before touching another
-- profile's row) -- same reasoning as migration 0065.
