-- Trainee-facing "Withdraw submission" (for-claude-code-trainee-interface.md's
-- Assignments tab). Same reason submit_assignment_round exists as a
-- security-definer RPC: migration 0023 dropped the trainee's broad UPDATE
-- policy on assignments, so a trainee has no direct write path at all
-- anymore. A plain .update() from the trainee's RLS-scoped client matches
-- zero rows and fails silently (no error, no effect) -- confirmed live.
-- Mirrors submit_assignment_round's own_row + status guard, just in reverse.
--
-- Only the first round is withdrawable -- the resubmission round is
-- intentionally excluded per spec ("doesn't use up the resubmission").

create or replace function public.withdraw_assignment_submission(
  p_assignment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.assignments
  set first_status = 'not_submitted',
      first_submitted_at = null,
      first_submitted_late = false,
      first_ai_declared = false,
      first_ai_conversation_url = null,
      first_own_work_confirmed = false
  where id = p_assignment_id
    and trainee_id = auth.uid()
    and first_status in ('submitted', 'pending');
end;
$$;
