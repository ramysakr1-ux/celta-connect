-- Course Admin.dc.html wizard steps 3-6, which arrived 2026-08-17. Fields the
-- design asks for that had nowhere to go.

-- Step 3 -- dates and timetable pattern. Times as text (HH:MM), matching the
-- design's "09:30" / "13:00"; days off as the pill-selected weekday list.
alter table public.courses add column if not exists input_start_time text;
alter table public.courses add column if not exists tp_start_time text;
alter table public.courses add column if not exists days_off text[];

-- Step 4 -- capacity and pricing. The design's "£1,395 fee, £250 deposit" and
-- "7 days after offer". Currency per course; numeric for real arithmetic.
alter table public.courses add column if not exists fee_amount numeric(10,2);
alter table public.courses add column if not exists deposit_amount numeric(10,2);
alter table public.courses add column if not exists fee_currency text;
alter table public.courses add column if not exists deposit_due_days integer;

-- Step 6 -- review and launch. "Launch opens the course to invites"; until
-- then it is a draft. Null = launched, for every course that predates the
-- wizard: treating existing live courses as unlaunched would freeze them.
alter table public.courses add column if not exists launched_at timestamptz;

comment on column public.courses.launched_at is
  'When the course was launched from the setup wizard (step 6). Launching moves it to Centre home and activates its Invitations panel. Null on courses that predate the wizard, which are treated as launched.';
comment on column public.courses.days_off is
  'Weekdays the course does not run, from step 3''s pill selector. Seeds the timetable tiles.';
