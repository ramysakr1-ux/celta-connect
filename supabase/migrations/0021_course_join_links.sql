-- Replaces email-based invites for trainer/trainee onboarding: each course
-- gets two standing, unguessable join tokens (like a Google Classroom join
-- code). Whoever has the link self-serves their own account -- no email
-- round-trip, so nothing to retry or go missing. Regenerating a token
-- invalidates the old link (e.g. if it leaked or was sent to the wrong
-- person) without needing a separate revocation flag.

alter table public.courses add column trainee_join_token uuid not null default gen_random_uuid();
alter table public.courses add column trainer_join_token uuid not null default gen_random_uuid();

create unique index courses_trainee_join_token_idx on public.courses (trainee_join_token);
create unique index courses_trainer_join_token_idx on public.courses (trainer_join_token);
