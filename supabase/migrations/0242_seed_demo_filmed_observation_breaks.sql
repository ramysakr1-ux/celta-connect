-- Ramy, 29 Aug 2026: "the film will pause... three pauses for sixty or
-- ninety seconds to give them a chance to chat and write."
--
-- Three breaks per recording, 90 seconds each, at roughly a quarter, half
-- and three quarters of each video's real duration so they land
-- proportionally however long the lesson runs (these range 35 to 59
-- minutes). A starting point, not a claim about what is on screen at that
-- exact second -- a trainer moves them in the setup form once they have
-- watched, the same "editable starting point" the timetable skeleton
-- already works on.
--
-- Not comprehension questions: "it could just be a prompt that you can
-- catch up on, take some notes and have a chat." The observation task is
-- where the real questions live. And the chat is specifically the
-- candidate's own TP group, via the chat pill that is already on this page
-- -- "compare notes with your TP group" -- since a trainee's group channel
-- is their TP group, not the whole cohort.
insert into filmed_observation_breaks (session_id, break_number, timestamp_seconds, duration_seconds, prompt)
select s.id, b.break_number, (s.length_minutes * 60 * b.fraction)::int, 90, b.prompt
from filmed_observation_sessions s
join courses c on c.id = s.course_id
join centers ce on ce.id = c.center_id and ce.is_demo = true
cross join (values
  (1, 0.25, 'Pause. Catch up on your notes, then compare notes with your TP group.'),
  (2, 0.50, 'Halfway. Add anything you have spotted, and compare notes with your TP group -- you will each have caught different things.'),
  (3, 0.75, 'Last pause. Get your notes down while it is fresh, and compare notes with your TP group before the end.')
) as b(break_number, fraction, prompt)
where s.length_minutes is not null
  and not exists (
    select 1 from filmed_observation_breaks x
    where x.session_id = s.id and x.break_number = b.break_number
  );

-- Re-runnable, and safe if an earlier version of this file was applied:
-- refreshes the wording in place, but ONLY where the prompt is still one
-- this migration wrote. A break a trainer has since edited keeps their
-- words.
update filmed_observation_breaks b
set prompt = v.prompt
from (values
  (1, 'Pause. Catch up on your notes, then compare notes with your TP group.'),
  (2, 'Halfway. Add anything you have spotted, and compare notes with your TP group -- you will each have caught different things.'),
  (3, 'Last pause. Get your notes down while it is fresh, and compare notes with your TP group before the end.')
) as v(break_number, prompt)
where b.break_number = v.break_number
  and b.prompt in (
    'Talk to your group: what has the teacher done so far to set this class up? Note anything you would use yourself.',
    'Halfway. What is the teacher doing while the learners work -- and what are they listening for?',
    'Nearly there. What can these learners do now that they could not at the start? What is your evidence?',
    'Pause. Catch up on your notes, and talk to whoever is watching with you about anything you have noticed so far.',
    'Halfway. Add anything you have spotted to your notes, and compare with your group -- you will each have caught different things.',
    'Last pause. Get your notes down while it is fresh, and talk over anything you want to raise in feedback.'
  );
