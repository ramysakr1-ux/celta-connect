-- Reordering a subgroup's rotation order means reassigning every member's
-- base_slot at once (it's a permutation). Doing that as separate UPDATE
-- statements from the app risks tripping the (subgroup_id, base_slot)
-- unique constraint mid-way (e.g. swapping two members' slots hits the
-- constraint on the first statement). This RPC does it atomically in two
-- passes within one transaction: first offset every member clear of the
-- target range, then set final values from the given order.

create function public.reorder_subgroup_members(p_subgroup_id uuid, p_ordered_trainee_ids uuid[])
returns void
language plpgsql
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.course_subgroup_members where subgroup_id = p_subgroup_id;

  if v_count != array_length(p_ordered_trainee_ids, 1) then
    raise exception 'Order list must include every member of the subgroup exactly once';
  end if;

  update public.course_subgroup_members
  set base_slot = base_slot + 10000
  where subgroup_id = p_subgroup_id;

  for i in 1..array_length(p_ordered_trainee_ids, 1) loop
    update public.course_subgroup_members
    set base_slot = i - 1
    where subgroup_id = p_subgroup_id and trainee_id = p_ordered_trainee_ids[i];
  end loop;
end;
$$;
