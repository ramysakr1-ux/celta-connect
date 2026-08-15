-- Schema-only half of the admin chat bar -- split from 0092 because
-- Postgres won't let a new enum value be used in the same transaction
-- that adds it (same gotcha as the user_role enum addition in migration
-- 0080, documented in project memory).
--
-- staff_channels.course_id already exists (added in migration 0039) --
-- confirmed by reading the actual migration history before writing this,
-- not assumed from the original 0008 schema which predates it.
alter type public.staff_channel_type add value 'course_admin';
