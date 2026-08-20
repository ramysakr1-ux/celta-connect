-- specs/handoffs/Supervised Review Quiz.dc.html resolves migration 0100's
-- own flagged open question ("reread-only vs reread+quiz isn't resolved
-- yet"): reread (notes) then a timed, auto-scored quiz, one of three fixed
-- topics the trainee picks per session. The handoff ships complete content
-- (45 questions across the three topics) -- src/lib/supervised-quiz-content.ts
-- is that content transcribed, not fabricated here.
alter table public.supervised_session_completions
  add column quiz_topic text check (quiz_topic in ('language', 'phonology', 'classroom'));
alter table public.supervised_session_completions add column score integer;
alter table public.supervised_session_completions add column question_count integer;
