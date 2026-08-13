-- specs/build-spec.md §"Peer observation -- the shared sheet": "The task is
-- generated from the criterion the cohort is working on, which comes from
-- that week's input session... input session -> criterion -> TP point ->
-- peer task -> TP feedback." Phase 1 (prerequisite) of building that: an
-- input session needs to be able to declare which criteria it covers.
-- Ramy already has all his input-session content authored -- this is a
-- data-entry task against existing material, not new instructional design.
alter table public.course_timetable_events
  add column input_session_criteria text[] not null default '{}';
