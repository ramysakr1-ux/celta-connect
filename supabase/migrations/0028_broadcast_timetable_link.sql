-- Lets a broadcast's Zoom time come from the course timetable
-- automatically, instead of being retyped per-broadcast -- matches
-- SS1.1a's core rule that the timetable is the single source of truth
-- for course dates and "nothing else invents dates". A broadcast can
-- still carry its own ad-hoc zoom_url/zoom_time for a one-off call not
-- tied to any scheduled event -- linking is optional, not mandatory.

alter table public.course_timetable_events add column zoom_url text;

alter table public.course_broadcasts
  add column linked_timetable_event_id uuid references public.course_timetable_events (id) on delete set null;
