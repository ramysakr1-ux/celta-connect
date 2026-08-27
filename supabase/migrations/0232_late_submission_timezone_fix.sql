-- Ramy, 28 Aug 2026: "the logic behind everything" -- submit_assignment_round
-- (0050) flagged first_submitted_late using `v_due_date < current_date`.
-- Postgres's current_date reads the SESSION's TimeZone setting, which is UTC
-- on Supabase, not the trainee's real centre. Every centre off UTC (the
-- app's own default is Europe/Istanbul, UTC+3) could have a submission
-- marked "late" up to several hours before -- or, right at the other
-- boundary, on time when it should already count as late -- its actual
-- centre-local deadline. Same bug class already fixed across ~15 TypeScript
-- call sites this session (see the app's own toLocalIso/zonedTimeToUtc
-- pattern) -- this is the one place it also existed in SQL.
create or replace function public.submit_assignment_round(
  p_assignment_id uuid,
  p_word_count int,
  p_ai_declared boolean,
  p_ai_conversation_url text
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
  if p_word_count < 750 or p_word_count > 1000 then
    raise exception 'This assignment must be between 750 and 1,000 words (currently %).', p_word_count;
  end if;

  if p_ai_declared and coalesce(trim(p_ai_conversation_url), '') = '' then
    raise exception 'You declared AI use -- add the conversation link before submitting.';
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
        first_ai_conversation_url = nullif(trim(p_ai_conversation_url), '')
    where id = p_assignment_id;
  elsif v_first_status = 'resubmission_required' and v_resubmission_status = 'not_submitted' then
    update public.assignments
    set resubmission_status = 'submitted', resubmission_submitted_at = now(),
        resubmission_ai_declared = p_ai_declared,
        resubmission_ai_conversation_url = nullif(trim(p_ai_conversation_url), '')
    where id = p_assignment_id;
  else
    raise exception 'This assignment is not awaiting submission.';
  end if;
end;
$$;
