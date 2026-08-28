-- Ramy, 28 Aug 2026: correcting a real mistake from earlier tonight.
-- Migration 0232 (the late-submission timezone fix) was built off 0050's
-- OLDER signature instead of 0181's actual latest one -- it silently
-- dropped the p_own_work_confirmed parameter, the own-work-confirmed
-- check, and the AI-conversation-URL format check that 0181 had added.
-- Since submit_assignment_round's client caller (dashboard/trainee/
-- assignments/[assignmentId]/actions.ts) calls it with p_own_work_confirmed
-- as a named parameter, this meant every real submission attempt since
-- 0232 ran would fail outright with "could not find function" -- a real
-- regression, not a hypothetical one. This migration restores the full
-- 0181 signature/checks, keeps the 0232 timezone fix, and additionally
-- removes the word-count hard block per Ramy's explicit instruction:
-- "I don't want it to be blocked if it exceeds the word count... there
-- will be a warning... but it should not block it" -- same rule the
-- client form (assignment-form.tsx) was just fixed to follow.
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
  v_time_zone text;
  v_local_today date;
begin
  if p_ai_declared and coalesce(trim(p_ai_conversation_url), '') = '' then
    raise exception 'You declared AI use -- add the conversation link before submitting.';
  end if;

  if p_ai_declared and trim(p_ai_conversation_url) !~* '^https?://[^\s]+\.[^\s]+' then
    raise exception 'That doesn''t look like a real link -- it should start with http:// or https://.';
  end if;

  if not p_own_work_confirmed then
    raise exception 'Confirm that this is your own work before submitting.';
  end if;

  select a.first_status, a.resubmission_status, a.due_date, coalesce(c.time_zone, 'Europe/Istanbul')
    into v_first_status, v_resubmission_status, v_due_date, v_time_zone
  from public.assignments a
  join public.profiles p on p.id = a.trainee_id
  left join public.centers c on c.id = p.center_id
  where a.id = p_assignment_id and a.trainee_id = auth.uid();

  if not found then
    raise exception 'Assignment not found.';
  end if;

  v_local_today := (now() at time zone v_time_zone)::date;

  if v_first_status = 'not_submitted' then
    update public.assignments
    set first_status = 'submitted', first_submitted_at = now(),
        first_submitted_late = (v_due_date is not null and v_due_date < v_local_today),
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
