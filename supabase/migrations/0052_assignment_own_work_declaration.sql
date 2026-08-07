-- Checkpoint 7 (CELTA 5) area 2 gap: the final-day checklist has always had
-- an "own work" tick (final_checklist_own_work, course-wide, one-off at the
-- end) and the cover-sheet PDF has always printed a static "I confirm this
-- assignment is my own work" line -- but nothing ever made the trainee
-- actually tick that per assignment, per round, at the moment they submit.
-- The design reference (CELTA 5 Record.dc.html, section 1b) and
-- build-spec.md both name it as its own required declaration, separate
-- from the AI-use declaration added in migration 0049. Same round-scoped
-- shape as the AI columns (a trainee could submit round 1 honestly and then
-- get help on a resubmission, or vice versa) and same hard-block pattern
-- (raise, not just a UI warning) as the word-count/AI checks already in
-- submit_assignment_round.

alter table public.assignments
  add column first_own_work_confirmed boolean not null default false,
  add column resubmission_own_work_confirmed boolean not null default false;

create or replace function public.submit_assignment_round(
  p_assignment_id uuid,
  p_word_count int,
  p_ai_declared boolean,
  p_ai_conversation_url text,
  p_own_work_confirmed boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_status public.submission_status;
  v_resubmission_status public.submission_status;
  v_due_date date;
begin
  if p_word_count < 750 or p_word_count > 1000 then
    raise exception 'This assignment must be between 750 and 1,000 words (currently %).', p_word_count;
  end if;

  if p_ai_declared and coalesce(trim(p_ai_conversation_url), '') = '' then
    raise exception 'You declared AI use -- add the conversation link before submitting.';
  end if;

  if not p_own_work_confirmed then
    raise exception 'Confirm that this is your own work before submitting.';
  end if;

  select first_status, resubmission_status, due_date
    into v_first_status, v_resubmission_status, v_due_date
  from public.assignments
  where id = p_assignment_id and trainee_id = auth.uid();

  if not found then
    raise exception 'Assignment not found.';
  end if;

  if v_first_status = 'not_submitted' then
    update public.assignments
    set first_status = 'submitted', first_submitted_at = now(),
        first_submitted_late = (v_due_date is not null and v_due_date < current_date),
        first_ai_declared = p_ai_declared,
        first_ai_conversation_url = nullif(trim(p_ai_conversation_url), ''),
        first_own_work_confirmed = true
    where id = p_assignment_id;
  elsif v_first_status = 'resubmission_required' and v_resubmission_status = 'not_submitted' then
    update public.assignments
    set resubmission_status = 'submitted', resubmission_submitted_at = now(),
        resubmission_ai_declared = p_ai_declared,
        resubmission_ai_conversation_url = nullif(trim(p_ai_conversation_url), ''),
        resubmission_own_work_confirmed = true
    where id = p_assignment_id;
  else
    raise exception 'This assignment is not awaiting submission.';
  end if;
end;
$$;
