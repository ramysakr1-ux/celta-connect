-- Found live: saveInterviewRecord's admissions_notifications insert (via
-- the caller's own session-scoped client, not the admin client) was
-- silently failing -- migration 0081 only ever added a SELECT policy for
-- this table, no INSERT policy, so RLS rejected every write and the
-- action didn't check the error. The interview record itself saved fine;
-- only the "interview completed, decision needed" notification never
-- appeared. Phase F's own notification-firing actions will hit the same
-- gap without this.
create policy "admissions_notifications: admissions staff insert their centre's"
on public.admissions_notifications for insert to authenticated
with check (public.can_handle_admissions() and center_id = public.current_center_id());
