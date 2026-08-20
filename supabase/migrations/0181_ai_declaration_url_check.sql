-- connect-spec-corrections-for-claude-code.md item 8, hard block 3: "the
-- link must be a well-formed URL." The other two hard blocks (own-work
-- confirmed, AI-declared-used requires a link) were already enforced here
-- server-side (migration 0052) -- this was the one missing, so it's added
-- the same way: a real raise exception in the function itself, not just a
-- client-side check a direct API call could skip past.
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

  -- Deliberately permissive -- catching "not a URL at all" (a bare word, a
  -- typo), not verifying the link actually resolves or belongs to a real
  -- AI tool (that's a tutor's judgment call, explicitly out of scope here).
  if p_ai_declared and trim(p_ai_conversation_url) !~* '^https?://[^\s]+\.[^\s]+' then
    raise exception 'That doesn''t look like a real link -- it should start with http:// or https://.';
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
