-- build-spec.md "Chat retention is a centre setting": three positions --
-- "Clear at midnight" / "Retain for a set period (7 or 30 days)" /
-- "Retain for the course" (cleared at close-out with everything else).
-- courses.chat_retention_days (migration 0154) can only express the first
-- two -- a plain rolling day count has no way to mean "until whenever this
-- course happens to close out." This adds the missing third mode; the day
-- count column is untouched and still governs the first two.

alter table public.courses
  add column chat_retention_mode text not null default 'days' check (chat_retention_mode in ('days', 'course'));
