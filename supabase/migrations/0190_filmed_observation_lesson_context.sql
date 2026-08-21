-- connect-video-library-and-filmed-observation-spec-2026-08-21.md §4 --
-- a trainee should see who's teaching, the level, learner count, and the
-- lesson's aims before they press play, same as walking into a real
-- observed lesson. level and learner_count already existed (migration
-- 0137) but were never actually surfaced anywhere in the trainee UI --
-- this closes that gap and adds the two fields that were genuinely
-- missing.
--
-- teacher_name is plain text, not a profiles FK: recording_url's own
-- comment already documents these as "a licensed recording you hold
-- rights to, or an internally-hosted file" -- often stock/licensed
-- footage of a teacher who was never a profiles row on this centre, so a
-- free-text name (matching how tp_video_library already handles
-- third-party content) covers every real case without an FK that would
-- fail for the common one.
alter table public.filmed_observation_sessions
  add column teacher_name text,
  add column main_aim text,
  add column sub_aim text;
