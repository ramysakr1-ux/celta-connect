-- for-claude-code-trainer-remaining-screens.md's Announcements screen:
-- announcements can be scheduled, anchored to a timetable event (never a
-- fixed date, so they duplicate correctly into the next course), and
-- optionally kept across a course duplication.
--
-- sent_at replaces "the row exists" as the live/visible signal: existing
-- rows are backfilled to created_at so every already-posted announcement
-- stays visible with no behaviour change; a new scheduled row is inserted
-- with sent_at left null until the cron (or a manual "Post now") fires it.
alter table public.course_broadcasts
  add column sent_at timestamptz,
  add column anchor_event_id uuid references public.course_timetable_events(id) on delete cascade,
  add column anchor_offset_days integer,
  add column keep_on_duplicate boolean not null default false;

update public.course_broadcasts set sent_at = created_at where sent_at is null;

comment on column public.course_broadcasts.sent_at is
  'When the announcement actually went live/visible to candidates. Null = still pending (scheduled, not yet fired).';
comment on column public.course_broadcasts.anchor_event_id is
  'Timetable event this announcement''s fire date is computed relative to. Null for an immediate, unanchored post.';
comment on column public.course_broadcasts.anchor_offset_days is
  'Days relative to anchor_event_id.event_date the announcement should fire (negative = before, 0 = same day).';
