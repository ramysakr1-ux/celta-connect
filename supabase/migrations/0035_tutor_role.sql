-- A course's tutor team is more than one undifferentiated "Trainer" role --
-- Ramy: main course tutor, assistant course tutor (possibly several),
-- teaching practice tutor, input session tutor, external assessor. Not all
-- of these are filled on every course; captured optionally when a trainer
-- joins via the trainer join link (see join/[token]/actions.ts). Left null
-- for anyone who joined before this migration -- the UI falls back to a
-- generic "Trainer" label in that case.
alter table public.profiles add column tutor_role text check (
  tutor_role in (
    'main_course_tutor',
    'assistant_course_tutor',
    'teaching_practice_tutor',
    'input_session_tutor',
    'external_assessor'
  )
);
