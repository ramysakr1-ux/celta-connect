-- build-spec.md §12: the admin channel is "**Centre-scoped, not
-- course-scoped.** Members: centre owner, centre admins, centre manager,
-- course admins. No tutors, no candidates." Named after the centre, "ITI
-- Istanbul · admin", "so nobody assumes a message reaches tutors."
--
-- What exists (migration 0091) is course-scoped: one 'course_admin' channel
-- per course. §13 rejects that shape too -- "one admin room per organisation,
-- not one per branch" -- since an admin covering two cities "is having one
-- conversation."
--
-- The trainer-only rule is untouched: this channel reaches into no course, and
-- course channels never appear in an admin's picker. §10 is absolute --
-- "course chat is absent from every admin role, including centre owner. No
-- exception, ever."

alter type public.staff_channel_type add value if not exists 'centre_admin';
