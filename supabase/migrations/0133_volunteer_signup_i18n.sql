-- Volunteer Sign-Up.dc.html's real 5-screen flow: a language chosen on
-- screen 1 ("the language becomes their L1 on file -- candidates need it
-- anyway, first-language interference is half of what a Focus on the
-- Learner assignment is about"), and two separate consent moments --
-- data consent on screen 2, recording consent on screen 4 ("agreeing to
-- the questions is not agreeing to be recorded").

alter table public.volunteer_signup_profiles
  add column if not exists l1_language text,
  add column if not exists consent_given_at timestamptz,
  add column if not exists recording_consent_given_at timestamptz;
