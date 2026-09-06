-- Whether a trainer-in-training's work is moderated by the course assessor.
--
-- Connect already knows a course HAS a trainer-in-training
-- (course_tutors.is_trainer_in_training, with a supervisor beside it) and has
-- never known the one thing that decides what the assessor must do about it.
--
-- CELTA Trainer-in-Training Handbook 2026, §5.1 steps 6a and 6b -- three
-- cases, not two:
--
--   External scheme                                  -> moderation REQUIRED
--   Internal scheme, trainer from another centre     -> moderation REQUIRED
--   Internal scheme, the centre's own trainer        -> NOT required. The
--     supervisor assesses them; they may still ask the visiting assessor for
--     a second opinion, and then the same report is completed.
--
-- So it takes two facts, and neither is inferable. The scheme is a Cambridge
-- approval granted to the CENTRE (§4.1: "two types of CELTA trainer-in-training
-- centre approved by Cambridge English"), decided at the nomination step and
-- written on the approval letter. Who nominated the trainer is a fact about
-- that person.
--
-- Where moderation applies it is not a small addition: §5.2.2 gives the
-- assessor five duties and usually a whole extra day, and Administration
-- Handbook §13.7 says the same. A centre that timetables the visit from the
-- candidate side alone under-books its assessor.

alter table public.centers
  add column if not exists tint_scheme text
  check (tint_scheme is null or tint_scheme in ('internal', 'external'));

comment on column public.centers.tint_scheme is
  'Cambridge''s trainer-in-training approval for this centre: internal (the centre assesses its own trainers), external (the course assessor does), or null -- not approved to train trainers at all. TinT Handbook 4.1-4.3. Read off the approval letter; never inferred.';

-- Free text, not a foreign key: the nominating centre is very often not a
-- Connect centre at all, and the name is what the report needs -- TinT
-- Handbook 5.1 sends the Assessor Moderation Report to "the JCA for the centre
-- nominating the trainer-in-training". Null means this centre nominated them,
-- which is the ordinary case.
alter table public.course_tutors
  add column if not exists tint_nominated_by text
  check (tint_nominated_by is null or length(btrim(tint_nominated_by)) between 2 and 200);

comment on column public.course_tutors.tint_nominated_by is
  'The centre that nominated this trainer-in-training, when it is not this one. Null = our own trainer. On the internal scheme this is what turns assessor moderation from optional into required (TinT Handbook 5.1, step 6b), and it names the JCA the moderation report goes to.';

notify pgrst, 'reload schema';
