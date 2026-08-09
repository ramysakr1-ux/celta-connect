-- remaining-compliance.md item 3: Handbook 2.2 -- recorded or Moodle input
-- "must always be combined with opportunities for live follow-up
-- discussion." Only meaningful on type='input_session' rows; the link is
-- to a real timetable slot (not free text) so it can't become a box
-- someone types "in class" into.

alter table public.course_timetable_events
  add column is_asynchronous boolean not null default false,
  add column linked_live_session_event_id uuid references public.course_timetable_events (id) on delete set null;
