-- Fixes infinite recursion (42P17) in the staff_channel_members RLS
-- policy: its USING clause queried staff_channel_members from within a
-- policy defined ON staff_channel_members, so evaluating one row
-- required re-evaluating the same policy, forever. Same class of bug
-- avoided elsewhere (is_admin(), current_center_id(), etc.) by routing
-- membership checks through a security-definer function instead, which
-- bypasses RLS on its own internal query and breaks the cycle.

create function public.is_staff_channel_member(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_channel_members
    where channel_id = p_channel_id and profile_id = auth.uid()
  );
$$;

drop policy if exists "staff_channels: members can read their channels" on public.staff_channels;
create policy "staff_channels: members can read their channels"
on public.staff_channels for select
to authenticated
using (public.is_staff_channel_member(id));

drop policy if exists "staff_channel_members: members can read fellow members of shared channels" on public.staff_channel_members;
create policy "staff_channel_members: members can read fellow members of shared channels"
on public.staff_channel_members for select
to authenticated
using (public.is_staff_channel_member(channel_id));

drop policy if exists "staff_messages: members can read messages in their channels" on public.staff_messages;
create policy "staff_messages: members can read messages in their channels"
on public.staff_messages for select
to authenticated
using (public.is_staff_channel_member(channel_id));

drop policy if exists "staff_messages: members can send messages in their channels" on public.staff_messages;
create policy "staff_messages: members can send messages in their channels"
on public.staff_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (public.is_trainer() or public.is_admin())
  and public.is_staff_channel_member(channel_id)
);
