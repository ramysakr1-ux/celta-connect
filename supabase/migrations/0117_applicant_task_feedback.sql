-- Comments on the candidate's task, shown on the application form.
--
-- Two separate things, and conflating them is the mistake this migration was
-- rewritten to avoid (Ramy, 2026-08-16):
--
--   1. AI NEVER sends anything to an applicant, and never writes a decision.
--      "Send an email for a reject by AI -- that's not possible. AI will only
--      flag it out, and then the trainer would take a look at it and then make
--      a decision." The flag notifies a tutor; the applicant hears nothing.
--
--   2. AI DOES comment on the application form, positive or negative. "They're
--      more like suggestions, basically. And then the trainer can accept them
--      or not."
--
-- So the AI text is a suggestion sitting on the form, not a draft of an email.
-- What reaches a candidate is only ever what the trainer settled on -- which
-- is also what full-email-specs.md carries into the offer and both rejections.
--
-- Keeping the suggestion separately from the trainer's text is what makes
-- "human-written, never generated" checkable rather than merely asserted: if
-- the final text is byte-identical to the suggestion, nobody edited anything,
-- and that is worth being able to establish if a candidate ever challenges a
-- decision.

-- Written defensively: an earlier version of this file named the second column
-- task_feedback_ai_draft. Rename it if that ran, add it if it did not.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applicants'
      and column_name = 'task_feedback_ai_draft'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applicants'
      and column_name = 'task_feedback_ai_suggestion'
  ) then
    alter table public.applicants rename column task_feedback_ai_draft to task_feedback_ai_suggestion;
  end if;
end $$;

-- The trainer's own text -- the only version that is ever shown to a candidate.
alter table public.applicants add column if not exists task_feedback text;
-- The AI's suggestion on the form. Advisory, and never sent on its own.
alter table public.applicants add column if not exists task_feedback_ai_suggestion text;
-- Whether the trainer actively took the suggestion, as opposed to writing past
-- it or ignoring it. Null = never considered.
alter table public.applicants add column if not exists task_feedback_ai_accepted boolean;
alter table public.applicants add column if not exists task_feedback_edited_by uuid references public.profiles (id) on delete set null;
alter table public.applicants add column if not exists task_feedback_edited_at timestamptz;

comment on column public.applicants.task_feedback is
  'The trainer''s own words about the task. The only version shown to a candidate, in the application form and in the offer or rejection email.';
comment on column public.applicants.task_feedback_ai_suggestion is
  'An AI suggestion on the application form, positive or negative. Advisory only -- never sent, never a decision.';
comment on column public.applicants.task_feedback_ai_accepted is
  'True when the trainer took the suggestion, false when they rejected it, null when they never considered it.';
