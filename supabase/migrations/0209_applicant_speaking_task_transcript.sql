-- Ramy, 24 Aug 2026: reversed the 17 Aug scope call ("we don't need a
-- transcript for the applicants... reviewed directly by a person") --
-- remembered the actual reason a transcript was wanted here in the first
-- place is AI suggestions on the speaking task, same as
-- for-claude-code-speech-to-text-integration.md always said. Column pair
-- mirrors volunteer_signup_profiles' transcript/transcript_generated_at.
alter table public.applicants
  add column speaking_task_transcript text,
  add column speaking_task_transcript_generated_at timestamptz;
