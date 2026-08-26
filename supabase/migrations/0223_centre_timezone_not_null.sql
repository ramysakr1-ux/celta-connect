-- centers.time_zone (migration 0155) has existed since the Profile & Drive
-- settings tab as a free-text, purely cosmetic field -- nothing in the app
-- ever read it to compute a date. Promoting it to the real source of truth
-- for every "what's today at this centre" check (previously a single
-- hardcoded constant, see timetable-grid.ts). Backfilling both existing
-- centres to Europe/Istanbul -- matches the constant it replaces, so
-- behaviour is unchanged until someone picks a different zone in Centre
-- Settings. NOT NULL with that same default going forward: Intl's
-- timezone lookup throws on null/invalid input, so every centre needs a
-- real value, not an optional one.
update public.centers set time_zone = 'Europe/Istanbul' where time_zone is null;
alter table public.centers alter column time_zone set default 'Europe/Istanbul';
alter table public.centers alter column time_zone set not null;
