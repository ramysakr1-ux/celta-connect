-- connect-build-specs-5-gaps-2026-08-21.md item 5: a prior doc claimed
-- close-out already blocks while a grade appeal is open. It doesn't --
-- blocking-rules.ts has exactly 3 reasons, none appeal-related, and there
-- was no "is an appeal open" state anywhere to check in the first place.
--
-- Per the decision on record: Connect's only role is the Grade Query
-- Reply (already built, migration 0064); the formal Cambridge appeal
-- itself happens entirely outside Connect. So this isn't a live appeal
-- tracker -- it's a manual flag a trainer/admin sets when they learn (out
-- of band) that a candidate has taken a filed reply to a formal appeal,
-- and clears when they learn it's resolved. Lives on grade_query_replies
-- since a reply is the precondition for an appeal existing at all.
alter table public.grade_query_replies
  add column appeal_raised_at timestamptz,
  add column appeal_raised_by uuid references public.profiles (id),
  add column appeal_resolved_at timestamptz,
  add column appeal_resolved_by uuid references public.profiles (id);
