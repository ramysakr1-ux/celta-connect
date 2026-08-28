-- Ramy, 29 Aug 2026: the five filmed-observation recordings, as YouTube
-- links. "We could just hook up to the link. It should be enough." -- no
-- downloading or re-hosting, which would mean storage cost for content we
-- do not own (observation 4 is a third-party channel's published demo
-- lesson, not this centre's own recording).
--
-- Titles and lengths are the videos' real metadata, read from YouTube
-- rather than invented. Teacher, level, learner count and the aims are
-- deliberately left null: they are not in the video metadata, so a trainer
-- fills them in through the existing setup form rather than having this
-- migration guess at them.
--
-- Demo course only (CELTA Demo Course at Connect CELTA Demo Centre), scoped
-- by matching the timetable event's own title so it cannot touch a real
-- centre's course. Re-runnable: conflicts on (timetable_event_id) update
-- the recording rather than inserting a second row.
insert into filmed_observation_sessions (course_id, timetable_event_id, lesson_title, recording_url, length_minutes)
select e.course_id,
       e.id,
       v.lesson_title,
       v.recording_url,
       v.length_minutes
from (values
  ('Filmed observation 1', 'Getting to know you -- online', 'https://youtu.be/4UKgBuDBALE', 59),
  ('Filmed observation 2', 'Reading and lexis', 'https://youtu.be/lMU9LaJjpss', 44),
  ('Filmed observation 3', 'Vocabulary: function and pronunciation', 'https://youtu.be/JDIRpzYupPU', 35),
  ('Filmed observation 4', 'Teaching a reading lesson -- pre-intermediate', 'https://youtu.be/YlzxRJY7Wbo', 36),
  ('Filmed observation 5', 'Drilling', 'https://youtu.be/5v346qd5Rps', 39)
) as v(event_title, lesson_title, recording_url, length_minutes)
join course_timetable_events e
  on e.title = v.event_title
 and e.type = 'milestone'
join courses c on c.id = e.course_id
join centers ce on ce.id = c.center_id and ce.is_demo = true
on conflict (timetable_event_id) do update
  set lesson_title   = excluded.lesson_title,
      recording_url  = excluded.recording_url,
      length_minutes = excluded.length_minutes;
