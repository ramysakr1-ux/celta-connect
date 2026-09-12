-- An unassessed teaching slot is a real kind of session, not a title.
--
-- Ramy, 12 Sep 2026, third time of asking: "Is it about the words 'getting to
-- know you', or the words 'unassessed', or are they just following whatever is
-- written on the timetable? ... it's not TP1. We should be able to still share
-- material with the trainees, still have it as a teaching slot, just not TP1.
-- It does not generate a lesson plan or feedback or any of that yet."
--
-- Exactly right, and the reason the same conversation kept coming back: these
-- sessions had no identity in the data, so every feature that needed to find
-- one matched on words in the title. A CELTA course has at least two -- day
-- one, where the candidates meet the learners, and the level change before
-- TP5, where they meet a new class -- and both are teaching, just not assessed
-- teaching practice.
--
-- So it gets its own type. A slot typed 'unassessed_tp':
--   * is a teaching slot: it sits in the group room on the timetable, it can
--     carry shared materials, it shows in the candidate's day;
--   * is NOT assessed TP: it carries no linked_tp_number, generates no lesson
--     plan, no feedback, no self-evaluation, and counts toward none of the six
--     assessed hours -- every one of those reads type = 'tp'.
alter table public.course_timetable_events
  drop constraint if exists course_timetable_events_type_check;

alter table public.course_timetable_events
  add constraint course_timetable_events_type_check check (
    type in (
      'input_session',
      'tp',
      'unassessed_tp',
      'assignment_due',
      'resubmission_due',
      'milestone',
      'supervised_session'
    )
  );
