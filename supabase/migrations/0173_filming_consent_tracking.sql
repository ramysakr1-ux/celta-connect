-- specs/admissions-and-close-out.md §10 "Filming consent": "Only used if a
-- centre films... Keep the signed form with the class register -- an
-- assessor expects consent for everyone in the room." The signature itself
-- is on paper (the printable template already exists at
-- src/app/api/filming-consent.pdf/route.ts); Connect's job is just tracking
-- who has actually handed one in, gated on whether the centre films at all.

alter table public.centers add column films_tp_sessions boolean not null default false;

alter table public.profiles add column filming_consent_confirmed_at timestamptz;
alter table public.profiles add column filming_consent_confirmed_by uuid references public.profiles (id) on delete set null;
