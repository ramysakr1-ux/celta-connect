-- Removes the old per-trainer Connect Hub link (added 0065) along with the
-- app-side setup page, header icon and roster entry point. That whole
-- feature assumed Connect Hub's old architecture -- "a separate Google
-- Apps Script project... access is purely a token baked into a URL" -- so
-- each person pasted their own personal tutor link once. The rebuilt
-- Connect Hub (22 Aug 2026) has no login or tokens at all: the same static
-- site for everyone, data moves by file export/import instead. Nothing
-- left to link per-person to, so nothing left to store. Ramy's call,
-- 22 Aug 2026: "delete the old one entirely."
alter table public.profiles drop column if exists connect_hub_link;
