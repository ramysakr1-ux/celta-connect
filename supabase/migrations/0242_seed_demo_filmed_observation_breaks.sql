-- Ramy, 29 Aug 2026: "the film will pause... three pauses for sixty or
-- ninety seconds to give them a chance to chat and write."
--
-- Three breaks per recording, 90 seconds each. Timestamps are placed at
-- roughly a quarter, a half and three quarters of each video's real
-- duration rather than at fixed clock times, so they land proportionally
-- however long the lesson runs (these range 35 to 59 minutes). They are a
-- sensible starting point, not a claim about what happens on screen at
-- that exact second -- a trainer moves them in the setup form once they
-- have watched, which is the same "editable starting point" the timetable
-- skeleton already works on.
--
-- Prompts are generic on purpose. A prompt tied to what is happening at
-- 14:12 of a specific recording can only be written by someone who has
-- watched it; inventing one here would put words in a trainer's mouth
-- about a lesson this migration has never seen.
insert into filmed_observation_breaks (session_id, break_number, timestamp_seconds, duration_seconds, prompt)
select s.id,
       b.break_number,
       (s.length_minutes * 60 * b.fraction)::int,
       90,
       b.prompt
from filmed_observation_sessions s
join courses c on c.id = s.course_id
join centers ce on ce.id = c.center_id and ce.is_demo = true
cross join (values
  (1, 0.25, 'Talk to your group: what has the teacher done so far to set this class up? Note anything you would use yourself.'),
  (2, 0.50, 'Halfway. What is the teacher doing while the learners work -- and what are they listening for?'),
  (3, 0.75, 'Nearly there. What can these learners do now that they could not at the start? What is your evidence?')
) as b(break_number, fraction, prompt)
where s.length_minutes is not null
  and not exists (
    select 1 from filmed_observation_breaks x
    where x.session_id = s.id and x.break_number = b.break_number
  );
