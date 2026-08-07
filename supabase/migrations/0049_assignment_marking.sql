-- Assignment Review.dc.html (checkpoint 6): real per-criterion Met/Not-met
-- marking, an outcome that can actually be a fail, a second marker on
-- resubmissions, and an AI-use declaration -- none of which existed in any
-- reachable form before this migration (the old first_content_grade/
-- first_english_grade pass-fail columns were only ever set from a dead,
-- unreachable page; left untouched here as historical, unused data rather
-- than migrated, since the design spec explicitly disavows that model:
-- "Marked as Met / Not met per criterion, per round -- not content/English
-- pass marks. An earlier design had this wrong.").
--
-- resubmission_outcome is the one genuinely missing piece: first_status /
-- resubmission_status (existing submission_status enum) keep doing
-- workflow/lock duty exactly as before, but that enum has no way to
-- express "the resubmission failed" -- approved is the only terminal
-- state. This column captures the resubmission round's real verdict
-- alongside it. Together with the existing statuses this maps the cover
-- sheet's four outcome boxes:
--   Pass                 = first_status = 'approved', no resubmission
--   Resubmission Needed  = first_status = 'resubmission_required'
--   Pass on Resubmission = resubmission_status = 'approved' and resubmission_outcome = 'pass'
--   Fail on Resubmission = resubmission_status = 'approved' and resubmission_outcome = 'fail'

alter table public.assignments
  add column resubmission_outcome text check (resubmission_outcome in ('pass', 'fail')),
  add column first_criteria_marks jsonb not null default '{}'::jsonb,
  add column resubmission_criteria_marks jsonb not null default '{}'::jsonb,
  -- marker_id is whichever trainer most recently returned a decision on
  -- either round -- normally the trainee's own tutor throughout, and the
  -- single "1st marker" fact the cover sheet prints regardless of which
  -- round triggered it. second_marker_id is the double-marking colleague,
  -- required only on a resubmission-round decision (Ramy's confirmed
  -- policy: every resubmission, pass or fail).
  add column marker_id uuid references public.profiles (id) on delete set null,
  add column second_marker_id uuid references public.profiles (id) on delete set null,
  add column second_marker_recorded_at timestamptz,
  -- No draft_url columns: a later spec delivery (specs/build-spec.md,
  -- "The unproofread-original requirement is dropped") explicitly retracts
  -- this -- "nobody can prove a draft is the original, so it collects a
  -- file that means nothing while adding a step to every submission." The
  -- declaration + conversation link carry the weight instead, matching
  -- Cambridge's own guidance (referencing required, not draft evidence).
  add column first_ai_declared boolean not null default false,
  add column first_ai_conversation_url text,
  add column resubmission_ai_declared boolean not null default false,
  add column resubmission_ai_conversation_url text;

-- Extends the existing submit_assignment_round (0023, fixed in 0024) with
-- the two submission-blocking rules Ramy confirmed: word count outside
-- 750-1,000 always blocks, and declaring AI use without a conversation
-- link always blocks (see column comment above for why no draft link is
-- required). Word count itself is computed client-side (assignment-form
-- .tsx's existing wordCount() helper) and passed in, rather than
-- re-implemented as a second regex in PL/pgSQL -- one source of truth for
-- what counts as a word. This is defense-in-depth alongside the
-- client-side disabled Submit button, not the primary UX.
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
begin
  if p_word_count < 750 or p_word_count > 1000 then
    raise exception 'This assignment must be between 750 and 1,000 words (currently %).', p_word_count;
  end if;

  if p_ai_declared and coalesce(trim(p_ai_conversation_url), '') = '' then
    raise exception 'You declared AI use -- add the conversation link before submitting.';
  end if;

  select first_status, resubmission_status, due_date
    into v_first_status, v_resubmission_status, v_due_date
  from public.assignments
  where id = p_assignment_id and trainee_id = auth.uid();

  if not found then
    raise exception 'Assignment not found.';
  end if;

  if v_first_status = 'not_submitted' then
    if v_due_date is not null and v_due_date < current_date then
      raise exception 'The deadline for this assignment has passed.';
    end if;
    update public.assignments
    set first_status = 'submitted', first_submitted_at = now(),
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
