-- Ramy, 29 Aug 2026: the four observation tasks, from his own design
-- (Filmed Observation Task.dc.html). "The observation tasks are fixed, so
-- you can go ahead and write them." FO1 goes with filmed observation 1 and
-- so on -- "they will go in that order, one two three four." Observation 5
-- deliberately has no task; there are four tasks, not five.
--
-- Needed a schema change first. filmed_observation_tasks held prompt_1,
-- prompt_2 and general_prompt -- three prompts -- because that was the
-- shape of the earlier spec. Every one of these tasks has EIGHT, so five
-- of them per task would have been silently dropped. Same fix as the
-- pre-course task: an ordered array, and answers keyed by index, so a task
-- can have as many prompts as it needs without another migration.
--
-- The old columns stay for now rather than being dropped: existing rows and
-- the code paths that read them still work, and nothing is gained by
-- breaking them in the same migration that adds the replacement.
alter table public.filmed_observation_tasks add column if not exists prompts text[];
alter table public.filmed_observation_task_responses add column if not exists responses jsonb;


-- FO1 — Classroom management — strengths and action points
insert into public.filmed_observation_tasks (session_id, prompts, prompt_1, prompt_2, general_prompt, rating_label, rating_options)
select s.id,
       array['Before you watch: from the input session, write down in your own words what classroom management covers. Keep the list in front of you while you watch.', 'How does the teacher use the space — where do they stand, when do they move, when do they get out of the way?', 'How are learners grouped, and how do the groupings change? Note how the teacher sets up each change and how long it takes.', 'What does the teacher do while learners are working? Note what they are listening for, and what they do with what they hear.', 'Instructions and checking: pick two task set-ups. Write down what the teacher said, and how they knew the class had understood.', 'Strengths. Name three things this teacher does well in managing the class. Give a timestamp for each.', 'Action points. Name two things you would do differently, and say what you would do instead — not just what was wrong.', 'One thing from this lesson you intend to use in your own teaching practice this week.'],
       'Before you watch: from the input session, write down in your own words what classroom management covers. Keep the list in front of you while you watch.',
       'How does the teacher use the space — where do they stand, when do they move, when do they get out of the way?',
       'One thing from this lesson you intend to use in your own teaching practice this week.',
       'How much of the lesson was learners working rather than the teacher managing?',
       array['Mostly teacher', 'Fairly even', 'Mostly learners']
from public.filmed_observation_sessions s
join public.course_timetable_events e on e.id = s.timetable_event_id
where e.title = 'Filmed observation 1'
  and not exists (select 1 from public.filmed_observation_tasks x where x.session_id = s.id);

update public.filmed_observation_tasks t
set prompts       = array['Before you watch: from the input session, write down in your own words what classroom management covers. Keep the list in front of you while you watch.', 'How does the teacher use the space — where do they stand, when do they move, when do they get out of the way?', 'How are learners grouped, and how do the groupings change? Note how the teacher sets up each change and how long it takes.', 'What does the teacher do while learners are working? Note what they are listening for, and what they do with what they hear.', 'Instructions and checking: pick two task set-ups. Write down what the teacher said, and how they knew the class had understood.', 'Strengths. Name three things this teacher does well in managing the class. Give a timestamp for each.', 'Action points. Name two things you would do differently, and say what you would do instead — not just what was wrong.', 'One thing from this lesson you intend to use in your own teaching practice this week.'],
    rating_label  = 'How much of the lesson was learners working rather than the teacher managing?',
    rating_options = array['Mostly teacher', 'Fairly even', 'Mostly learners']
from public.filmed_observation_sessions s
join public.course_timetable_events e on e.id = s.timetable_event_id
where t.session_id = s.id
  and e.title = 'Filmed observation 1'
  and t.prompts is distinct from array['Before you watch: from the input session, write down in your own words what classroom management covers. Keep the list in front of you while you watch.', 'How does the teacher use the space — where do they stand, when do they move, when do they get out of the way?', 'How are learners grouped, and how do the groupings change? Note how the teacher sets up each change and how long it takes.', 'What does the teacher do while learners are working? Note what they are listening for, and what they do with what they hear.', 'Instructions and checking: pick two task set-ups. Write down what the teacher said, and how they knew the class had understood.', 'Strengths. Name three things this teacher does well in managing the class. Give a timestamp for each.', 'Action points. Name two things you would do differently, and say what you would do instead — not just what was wrong.', 'One thing from this lesson you intend to use in your own teaching practice this week.'];


-- FO2 — Lesson type and framework — what kind of lesson is this?
insert into public.filmed_observation_tasks (session_id, prompts, prompt_1, prompt_2, general_prompt, rating_label, rating_options)
select s.id,
       array['Is this a language lesson or a skills lesson? Say how you decided, and give the moment in the recording that told you.', 'If it is a skills lesson, is it receptive or productive? If it is a language lesson, is the focus grammar, vocabulary, functional language or pronunciation?', 'Name the framework the teacher is working to. If it does not match one you have been taught, describe the shape you actually see.', 'Map the stages with timestamps. For each stage write one line: what the learners were asked to do.', 'What is the main aim of this lesson, in one sentence, in your own words? Do not copy the teacher’s wording.', 'Which stage did the most work towards that aim, and which stage could have been cut?', 'How does each stage prepare the one after it? Find one link that works well and one that is missing.', 'Action point: one change to the staging you would make, and what it would achieve.'],
       'Is this a language lesson or a skills lesson? Say how you decided, and give the moment in the recording that told you.',
       'If it is a skills lesson, is it receptive or productive? If it is a language lesson, is the focus grammar, vocabulary, functional language or pronunciation?',
       'Action point: one change to the staging you would make, and what it would achieve.',
       'How clearly did the shape of the lesson come across?',
       array['Hard to follow', 'Mostly clear', 'Very clear']
from public.filmed_observation_sessions s
join public.course_timetable_events e on e.id = s.timetable_event_id
where e.title = 'Filmed observation 2'
  and not exists (select 1 from public.filmed_observation_tasks x where x.session_id = s.id);

update public.filmed_observation_tasks t
set prompts       = array['Is this a language lesson or a skills lesson? Say how you decided, and give the moment in the recording that told you.', 'If it is a skills lesson, is it receptive or productive? If it is a language lesson, is the focus grammar, vocabulary, functional language or pronunciation?', 'Name the framework the teacher is working to. If it does not match one you have been taught, describe the shape you actually see.', 'Map the stages with timestamps. For each stage write one line: what the learners were asked to do.', 'What is the main aim of this lesson, in one sentence, in your own words? Do not copy the teacher’s wording.', 'Which stage did the most work towards that aim, and which stage could have been cut?', 'How does each stage prepare the one after it? Find one link that works well and one that is missing.', 'Action point: one change to the staging you would make, and what it would achieve.'],
    rating_label  = 'How clearly did the shape of the lesson come across?',
    rating_options = array['Hard to follow', 'Mostly clear', 'Very clear']
from public.filmed_observation_sessions s
join public.course_timetable_events e on e.id = s.timetable_event_id
where t.session_id = s.id
  and e.title = 'Filmed observation 2'
  and t.prompts is distinct from array['Is this a language lesson or a skills lesson? Say how you decided, and give the moment in the recording that told you.', 'If it is a skills lesson, is it receptive or productive? If it is a language lesson, is the focus grammar, vocabulary, functional language or pronunciation?', 'Name the framework the teacher is working to. If it does not match one you have been taught, describe the shape you actually see.', 'Map the stages with timestamps. For each stage write one line: what the learners were asked to do.', 'What is the main aim of this lesson, in one sentence, in your own words? Do not copy the teacher’s wording.', 'Which stage did the most work towards that aim, and which stage could have been cut?', 'How does each stage prepare the one after it? Find one link that works well and one that is missing.', 'Action point: one change to the staging you would make, and what it would achieve.'];


-- FO3 — Teacher language and learner response
insert into public.filmed_observation_tasks (session_id, prompts, prompt_1, prompt_2, general_prompt, rating_label, rating_options)
select s.id,
       array['Pick any five minutes of the lesson. Note roughly how much of it is the teacher talking, and whether that talk was doing a job.', 'Write down three questions the teacher asked, exactly as asked. For each, say what it was for: checking, eliciting, or moving the lesson on.', 'Find one point where the teacher told the class something they could have got from the learners instead.', 'Note any language the teacher used that was above the level of the class. What would you have said?', 'How do learners respond — in full, in single words, to the teacher, or to each other? Give examples with timestamps.', 'Errors: note two the teacher dealt with and one they let go. Was each decision the right one?', 'Strengths. Two things about the way this teacher talks to the class that you would take for yourself.', 'Action point: one thing you would change about the teacher’s language, and why.'],
       'Pick any five minutes of the lesson. Note roughly how much of it is the teacher talking, and whether that talk was doing a job.',
       'Write down three questions the teacher asked, exactly as asked. For each, say what it was for: checking, eliciting, or moving the lesson on.',
       'Action point: one thing you would change about the teacher’s language, and why.',
       'Balance of teacher talk to learner talk',
       array['Teacher-heavy', 'Balanced', 'Learner-heavy']
from public.filmed_observation_sessions s
join public.course_timetable_events e on e.id = s.timetable_event_id
where e.title = 'Filmed observation 3'
  and not exists (select 1 from public.filmed_observation_tasks x where x.session_id = s.id);

update public.filmed_observation_tasks t
set prompts       = array['Pick any five minutes of the lesson. Note roughly how much of it is the teacher talking, and whether that talk was doing a job.', 'Write down three questions the teacher asked, exactly as asked. For each, say what it was for: checking, eliciting, or moving the lesson on.', 'Find one point where the teacher told the class something they could have got from the learners instead.', 'Note any language the teacher used that was above the level of the class. What would you have said?', 'How do learners respond — in full, in single words, to the teacher, or to each other? Give examples with timestamps.', 'Errors: note two the teacher dealt with and one they let go. Was each decision the right one?', 'Strengths. Two things about the way this teacher talks to the class that you would take for yourself.', 'Action point: one thing you would change about the teacher’s language, and why.'],
    rating_label  = 'Balance of teacher talk to learner talk',
    rating_options = array['Teacher-heavy', 'Balanced', 'Learner-heavy']
from public.filmed_observation_sessions s
join public.course_timetable_events e on e.id = s.timetable_event_id
where t.session_id = s.id
  and e.title = 'Filmed observation 3'
  and t.prompts is distinct from array['Pick any five minutes of the lesson. Note roughly how much of it is the teacher talking, and whether that talk was doing a job.', 'Write down three questions the teacher asked, exactly as asked. For each, say what it was for: checking, eliciting, or moving the lesson on.', 'Find one point where the teacher told the class something they could have got from the learners instead.', 'Note any language the teacher used that was above the level of the class. What would you have said?', 'How do learners respond — in full, in single words, to the teacher, or to each other? Give examples with timestamps.', 'Errors: note two the teacher dealt with and one they let go. Was each decision the right one?', 'Strengths. Two things about the way this teacher talks to the class that you would take for yourself.', 'Action point: one thing you would change about the teacher’s language, and why.'];


-- FO4 — Learning and outcomes — what did the class leave with?
insert into public.filmed_observation_tasks (session_id, prompts, prompt_1, prompt_2, general_prompt, rating_label, rating_options)
select s.id,
       array['What could the learners do at the end of the lesson that they could not do at the start? Give the evidence you are basing that on.', 'Find the point in the lesson where you can first see learning happening. What is happening on screen?', 'Pick one learner you can see or hear throughout. Track what they do across the lesson and what they get out of it.', 'Were all learners engaged, or only some? Note any learner who dropped out of the lesson, and when.', 'How does the teacher find out what has been learned? Note every check they make, and how reliable each one is.', 'Feedback: how is it given — on the spot, delayed, on the board, learner to learner? Give timestamps.', 'Strengths. Two things the teacher did that made the learning happen.', 'Action point: one change that would have got more learning out of the same 45 minutes.'],
       'What could the learners do at the end of the lesson that they could not do at the start? Give the evidence you are basing that on.',
       'Find the point in the lesson where you can first see learning happening. What is happening on screen?',
       'Action point: one change that would have got more learning out of the same 45 minutes.',
       'How far was the aim of the lesson achieved?',
       array['Partly', 'Largely', 'Fully']
from public.filmed_observation_sessions s
join public.course_timetable_events e on e.id = s.timetable_event_id
where e.title = 'Filmed observation 4'
  and not exists (select 1 from public.filmed_observation_tasks x where x.session_id = s.id);

update public.filmed_observation_tasks t
set prompts       = array['What could the learners do at the end of the lesson that they could not do at the start? Give the evidence you are basing that on.', 'Find the point in the lesson where you can first see learning happening. What is happening on screen?', 'Pick one learner you can see or hear throughout. Track what they do across the lesson and what they get out of it.', 'Were all learners engaged, or only some? Note any learner who dropped out of the lesson, and when.', 'How does the teacher find out what has been learned? Note every check they make, and how reliable each one is.', 'Feedback: how is it given — on the spot, delayed, on the board, learner to learner? Give timestamps.', 'Strengths. Two things the teacher did that made the learning happen.', 'Action point: one change that would have got more learning out of the same 45 minutes.'],
    rating_label  = 'How far was the aim of the lesson achieved?',
    rating_options = array['Partly', 'Largely', 'Fully']
from public.filmed_observation_sessions s
join public.course_timetable_events e on e.id = s.timetable_event_id
where t.session_id = s.id
  and e.title = 'Filmed observation 4'
  and t.prompts is distinct from array['What could the learners do at the end of the lesson that they could not do at the start? Give the evidence you are basing that on.', 'Find the point in the lesson where you can first see learning happening. What is happening on screen?', 'Pick one learner you can see or hear throughout. Track what they do across the lesson and what they get out of it.', 'Were all learners engaged, or only some? Note any learner who dropped out of the lesson, and when.', 'How does the teacher find out what has been learned? Note every check they make, and how reliable each one is.', 'Feedback: how is it given — on the spot, delayed, on the board, learner to learner? Give timestamps.', 'Strengths. Two things the teacher did that made the learning happen.', 'Action point: one change that would have got more learning out of the same 45 minutes.'];

