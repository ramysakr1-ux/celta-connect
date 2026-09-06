-- The centre-manager route actually bypasses the tutors.
--
-- The trainee's own form offers three routes, and says of the third: "The
-- centre manager -- independent of the teaching team. For anything you would
-- rather the tutors did not see first." Migration 0140 then gave every
-- trainer on the course read and write on every concern regardless of route,
-- deliberately ("not on which of the three named recipients a concern happens
-- to be addressed to"). So the promise on the form was not true: a candidate
-- who routed a concern away from their tutors had it land in front of them.
--
-- That is not a cosmetic mismatch. Administration Handbook 16.1 requires the
-- centre's internal complaints procedure to provide "recourse to someone
-- other than the tutors on the course" -- the manager route IS that recourse,
-- and it was the one thing 0140 could not afford to get wrong. 16.4 sharpens
-- it further: Cambridge cannot investigate anything "for which there is no
-- record", so this table is where an appeal's evidence lives.
--
-- After this migration:
--   route 'tutor' / 'mct'  -- the course's trainers, as before.
--   route 'manager'        -- centre admins only. No trainer on the course
--                             can read it, reply to it, or learn it exists
--                             from the data layer.
--
-- Anonymity is unchanged and still application-level (0140's own note): it
-- hides the name, and was never a substitute for hiding the concern from the
-- wrong readers.

drop policy if exists "concerns: trainer manages their course's concerns" on public.concerns;

-- Split in two rather than one ALL policy, so the route restriction cannot be
-- accidentally widened by a later write policy: a trainer may read and answer
-- the two routes addressed to the teaching team, and nothing else.
create policy "concerns: trainer reads their course's non-manager concerns"
on public.concerns for select
to authenticated
using (
  (select public.is_trainer())
  and course_id = (select public.current_course_id())
  and route <> 'manager'
);

create policy "concerns: trainer answers their course's non-manager concerns"
on public.concerns for update
to authenticated
using (
  (select public.is_trainer())
  and course_id = (select public.current_course_id())
  and route <> 'manager'
)
with check (
  (select public.is_trainer())
  and course_id = (select public.current_course_id())
  and route <> 'manager'
);

-- The admin policy already covers every route for the centre's own staff and
-- is left exactly as migration 0269 rewrote it (held_center_ids()).

comment on column public.concerns.route is
  'Who the candidate chose to tell. tutor/mct are readable by the course''s trainers; manager is centre-admin only -- Administration Handbook 16.1''s "recourse to someone other than the tutors on the course". Enforced in RLS, not in the UI.';

notify pgrst, 'reload schema';
