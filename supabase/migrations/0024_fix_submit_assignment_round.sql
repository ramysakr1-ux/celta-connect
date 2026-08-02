-- Fixes submit_assignment_round (migration 0023): the composite-row-type
-- variable ("v_assignment public.assignments") failed at runtime with
-- "record v_assignment has no field due_date" -- selecting the needed
-- columns into scalar variables instead sidesteps whatever caused that and
-- is the more idiomatic PL/pgSQL approach regardless.

create or replace function public.submit_assignment_round(p_assignment_id uuid)
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
    set first_status = 'submitted', first_submitted_at = now()
    where id = p_assignment_id;
  elsif v_first_status = 'resubmission_required' and v_resubmission_status = 'not_submitted' then
    update public.assignments
    set resubmission_status = 'submitted', resubmission_submitted_at = now()
    where id = p_assignment_id;
  else
    raise exception 'This assignment is not awaiting submission.';
  end if;
end;
$$;
