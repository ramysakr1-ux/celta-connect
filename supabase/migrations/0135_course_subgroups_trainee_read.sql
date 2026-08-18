-- Found while verifying the broadcast visibility fix (migration 0134): a
-- trainee has never had a SELECT policy on course_subgroups at all (only
-- trainer/admin, migration 0014). course_subgroup_members already lets a
-- trainee read their own membership row, but resolving from there to the
-- subgroup's tp_group_id/half_order -- which both today-tab.tsx's "you
-- teach today" panel and the new broadcast group-scope filter need --
-- silently returned nothing for every real trainee session. Uses the
-- existing current_subgroup_id() helper (migration 0025), same pattern as
-- every other trainee-own-subgroup policy since.
create policy "course_subgroups: trainee reads their own subgroup"
on public.course_subgroups for select
to authenticated
using (id = public.current_subgroup_id());
