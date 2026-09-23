-- The TP feedback session is a kind of session, not a word in a title.
--
-- Same argument as 0296 made for the unassessed teaching slot, and the same
-- smell that gave it away: six places in the app decided whether a timetable
-- row was the feedback session, and they did it three different ways --
-- `title === 'Feedback'` in the timetable (twice), the trainee's rail and the
-- assessor day, and `title.toLowerCase().startsWith('feedback')` in the TP
-- queue. 8453fdf0 made them all ask the same question; it could not make the
-- question a good one.
--
-- Why a title cannot answer it. Three shapes are in this table right now, and
-- all three are real:
--
--    28  supervised_session | Feedback              | Self-evaluations lead
--     2  supervised_session | Feedback              | Written feedback only
--     2  supervised_session | Written feedback only | Final TP, no live session
--     2  input_session      | Giving feedback on tasks
--
-- The first three are the feedback session. The fourth is an INPUT session
-- about giving feedback, which any `like '%feedback%'` would have swept up --
-- so the predicate had to be `startsWith`, which in turn missed the third
-- shape. The generator (timetable-skeleton.ts) writes the second shape for a
-- written-only day and the demo seed writes the third, so the two disagreed
-- about the same thing and the assessor's "no Feedback session is timetabled
-- on the visit date" warning fired correctly on one and stayed silent on the
-- other.
--
-- Handbook 14.2 is what makes that worth fixing rather than tidying: "The
-- assessor then observes the feedback." A visit day whose only feedback is
-- written is a day with nothing to observe, and the centre needs telling
-- while the timetable can still change.
--
-- So: two facts, two columns.
--
--   type = 'feedback'        -- this row IS the TP feedback session
--   feedback_written_only    -- ...and there is no live session to attend
--
-- A written-only day keeps type 'feedback' deliberately. The session exists
-- and the candidate must see it; what differs is that it cannot be observed.
-- Typing it as something else would hide it from the candidate's own day to
-- satisfy the assessor's check, which is the wrong trade.

-- Re-runnable: drop and re-add, exactly as 0296 did.
alter table public.course_timetable_events
  drop constraint if exists course_timetable_events_type_check;

alter table public.course_timetable_events
  add constraint course_timetable_events_type_check check (
    type in (
      'input_session',
      'tp',
      'unassessed_tp',
      'feedback',
      'assignment_due',
      'resubmission_due',
      'milestone',
      'supervised_session'
    )
  );

alter table public.course_timetable_events
  add column if not exists feedback_written_only boolean not null default false;

comment on column public.course_timetable_events.feedback_written_only is
  'Feedback rows only: the feedback is written, with no live session to attend '
  'or for an assessor to observe (Handbook 14.2). Set by the timetable '
  'generator for the final TP days.';

-- Backfill, narrowly. Only supervised_session rows, and only the two titles
-- that have ever meant the feedback session -- never 'Giving feedback on
-- tasks', which is an input session and matches neither test below.
update public.course_timetable_events
set
  type = 'feedback',
  feedback_written_only = (
    coalesce(detail, '') ilike '%written feedback only%'
    or title ilike 'written feedback only%'
  )
where type = 'supervised_session'
  and (title ilike 'feedback%' or title ilike 'written feedback only%');

notify pgrst, 'reload schema';

-- Proof it ran, because "Success. No rows returned" is what DDL says whether
-- it did anything or not. Expect: the column present, and every row that used
-- to be a feedback session now typed as one.
select
  (select count(*) from public.course_timetable_events where type = 'feedback') as feedback_rows,
  (select count(*) from public.course_timetable_events where type = 'feedback' and feedback_written_only) as written_only_rows,
  (select count(*) from public.course_timetable_events
     where type = 'supervised_session' and title ilike 'feedback%') as leftover_should_be_zero,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'course_timetable_events'
       and column_name = 'feedback_written_only') as column_present;
