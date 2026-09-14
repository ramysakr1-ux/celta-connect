-- 0304 -- Drop the columns that are genuinely inert.
--
-- Ramy asked to clean up the 24 columns no app code references. Checking each
-- one first (his own rule: "what if I hadn't asked, would you have deleted
-- all of that?"), only SIX are safe. The rest are load-bearing, hold real
-- record data, or belong to a feature that is pending rather than dead, and
-- a column drop cannot be undone.
--
-- What is dropped here, and why each is safe:
--
--   centers.primary_color / accent_color
--     Nullable, null on all 3 centres, referenced nowhere in src or scripts,
--     no index, constraint, function or view. Centre branding today is
--     logo_url, which IS used.
--
--   centers.admissions_stale_threshold_days
--     `not null default 5`, so every row holds the default and nothing else.
--     0081 planned a "sitting without a decision (default 5 working days)"
--     notification; no such check exists anywhere, and there is no UI to
--     change the number. It configures nothing.
--
--   applicants.task_feedback_ai_accepted
--     Null on all 28 applicants. Its only mention outside the DDL is a
--     `comment on column`.
--
--   applicants.notification_opt_outs
--     `not null default '{}'`: 28 empty arrays, never written, never read,
--     and no opt-out control exists for applicants. The real unsubscribe
--     flow is the volunteer one at /student/[token]/unsubscribe, which uses
--     its own columns and is untouched.
--
--   the finances table
--     Zero rows, and the only mention of the name anywhere in src is the
--     generated type. Payments live in `refunds`, `payment_instalments` and
--     `payment_provider_transactions`, which are all real.
--
-- NOT dropped, and why -- do not add these to this migration later without
-- re-checking:
--   profiles.signature_set_at        an RPC writes it (0186 set_signature_name)
--   refunds.provider_refund_id       backs a UNIQUE partial index; idempotency
--   tit_observed_sessions.observed_at   60 real timestamps -- TinT record data
--   scavenger_hunt_progress.found_at    83 real timestamps
--   applicants.source_link_id        FK to application_links: provenance
--   course_invitations.accepted_profile_id, platform_demo_login_links.*  FKs
--   volunteer_students.signup_written_answers / signup_audio_url,
--   filmed_observation_views.first_opened_at,
--   supervised_session_completions.started_at, refunds.payment_instalment_id,
--   profiles.is_platform_demo_login  pending features on empty tables;
--                                    dropping them gains nothing and would
--                                    have to be re-added to finish the work.

alter table public.centers
  drop column if exists primary_color,
  drop column if exists accent_color,
  drop column if exists admissions_stale_threshold_days;

alter table public.applicants
  drop column if exists task_feedback_ai_accepted,
  drop column if exists notification_opt_outs;

-- Empty and unreferenced. Omit this statement if you would rather keep the
-- shape for a finance feature you still intend to build.
drop table if exists public.finances;

notify pgrst, 'reload schema';

select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'centers'
       and column_name in ('primary_color', 'accent_color', 'admissions_stale_threshold_days')) as centre_cols_left,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'applicants'
       and column_name in ('task_feedback_ai_accepted', 'notification_opt_outs')) as applicant_cols_left,
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'finances') as finances_table_left;
