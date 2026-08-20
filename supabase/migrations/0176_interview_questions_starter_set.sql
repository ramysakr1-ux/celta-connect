-- specs/handoffs/Interview Questions.dc.html: "A centre setting up should
-- not have to write eight questions from nothing. Connect ships a set
-- covering what the handbook asks selection to assess, and the centre
-- edits it into their own -- the same arrangement as the get-to-know-you
-- bank." Unlike GTKY's bank (fixed, global, lives in code), this one is
-- explicitly per-centre and editable, so it has to be real rows, not a
-- code constant -- seeded here per centre rather than at centre-creation
-- time, since nothing in the app currently creates a centers row at all
-- (confirmed: no insert-into-centers call anywhere in src/) -- the day a
-- real centre-signup flow exists, it should seed this same set.
--
-- Digital literacy is deliberately left unseeded, matching the handoff's
-- own note: "This centre runs face-to-face, so it never wrote one. The
-- moment they set up a mixed-mode course, 6.2 requires it and the bank
-- should say so" -- the existing missing-coverage warning already handles
-- that correctly once it applies.
--
-- Only seeds centres with an empty bank (never touches one that's already
-- been edited into something else), so this is safe to re-run.
insert into public.interview_questions (center_id, question_text, coverage_area)
select c.id, q.question_text, q.coverage_area
from public.centers c
cross join (
  values
    ('Why CELTA, and why now?', 'motivation_suitability'),
    ('Talk me through a lesson that did not go the way you planned.', 'classroom_presence'),
    ('A learner asks why we say "I have lived here for five years" and not "I live here for five years". What do you say?', 'language_awareness'),
    ('This course is intensive and full-time. What have you arranged for the five weeks?', 'time_commitment'),
    ('You will be observed teaching from the first week and given feedback in front of your group. How does that sit with you?', 'flexibility_openness'),
    ('Tell me about a time you had to learn something difficult quickly.', 'other'),
    ('Is there anything about the course, or about how you work, that we should know?', 'other')
) as q(question_text, coverage_area)
where not exists (
  select 1 from public.interview_questions existing where existing.center_id = c.id
);
