-- Ramy, 26 Aug 2026: the promised turnaround for a written-task decision
-- (interview or rejection) is realistically hours, not days -- "it could be
-- six hours, it could be ten hours depending on the centre." A whole-number
-- "working days" field can't express that, so this renames the column
-- rather than adding a new one -- same concept (a centre's own promised
-- turnaround), finer unit. The stored value itself needs no conversion:
-- whatever number a centre already had here reads sensibly as hours too.
alter table public.centers
  rename column application_response_days to application_response_hours;

comment on column public.centers.application_response_hours is
  'Hours after an application arrives by which the centre aims to respond with a decision. Centre-set, not currently quoted in any email.';
