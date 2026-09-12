-- guard_trainee_comment_columns (0023) stops a trainee's own write from
-- touching the tutor's comment columns. It tests is_trainer() / is_admin(),
-- and the service-role connection is neither -- so the seed's comments were
-- nulled on insert, and a direct service-role update to first_comments
-- returned 200 and changed nothing (found 12 Sep 2026: every marked
-- assignment on the demo read "No feedback yet."). The service role is the
-- seed and the operator, never a trainee; let it through like a trainer.
-- Re-runnable.
create or replace function public.guard_assignment_section_response_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_trainer() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.first_comments := null;
    new.resubmission_comments := null;
  else
    new.first_comments := old.first_comments;
    new.resubmission_comments := old.resubmission_comments;
  end if;
  return new;
end;
$$;
