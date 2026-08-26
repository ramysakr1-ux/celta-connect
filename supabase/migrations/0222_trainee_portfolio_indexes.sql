-- Perf audit, 2026-08-26: tp_feedback, individual_tutorial_invites, and
-- peer_observation_notes are all filtered by trainee_id/observer_id on the
-- trainee portfolio's hot path (loaded on nearly every /portfolio/:id/*
-- visit), but none of the three had an index covering that column -- each
-- was a full table scan. individual_tutorial_invites had a course_id index
-- (wrong leading column for a trainee_id-only lookup) and
-- peer_observation_notes had unique(sheet_id, observer_id) (wrong leading
-- column for an observer_id-only lookup); tp_feedback had no index on
-- trainee_id at all.
create index tp_feedback_trainee_id_idx on public.tp_feedback (trainee_id);
create index individual_tutorial_invites_trainee_id_idx on public.individual_tutorial_invites (trainee_id);
create index peer_observation_notes_observer_id_idx on public.peer_observation_notes (observer_id);
