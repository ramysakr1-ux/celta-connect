-- Which interactive session a timetable slot opens, set by a person.
--
-- Until now the link between a timetable session and one of the Connect
-- Native input sessions was an exact match on the TITLE
-- (src/lib/input-session-registry-links.ts). That map is hand-curated and
-- deliberately not fuzzy -- guessing wrong would silently point a candidate
-- at the wrong content -- but it means a centre that renames a session, or
-- names one something the map has never seen, gets a card that will not
-- open, with nothing anywhere saying why.
--
-- Ramy has hit this twice: "some of them work, some of them don't" (29 Aug,
-- 1 Sep) and "they're supposed to be interactive but they're not" (13 Sep).
-- Each time the fix was to add more titles to a list in the code, which is
-- not a fix a centre can make.
--
-- So the tutor picks it. `registry_slug` is a plain text column holding an
-- input-session slug; the title map stays as the fallback for every event
-- nobody has picked for. A person's choice always wins over a string match.
--
-- Deliberately NOT a foreign key: the slugs live in the code registry
-- (src/app/input-sessions/registry.ts), not in a table, and a slug that no
-- longer exists should leave the card unlinked rather than block the
-- migration or the write.
--
-- Re-runnable.

alter table public.course_timetable_events
  add column if not exists registry_slug text;

comment on column public.course_timetable_events.registry_slug is
  'Slug of the Connect Native input session this slot opens (src/app/input-sessions/registry.ts). Null = fall back to the title map.';

notify pgrst, 'reload schema';

-- Proof it ran.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = 'course_timetable_events'
      and column_name = 'registry_slug') as registry_slug_column_should_be_1,
  (select count(*) from public.course_timetable_events where type = 'input_session') as input_session_slots;
