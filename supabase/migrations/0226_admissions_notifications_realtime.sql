-- Ramy, 27 Aug 2026: "a different color light until someone clicks on it" --
-- the Centre Management admissions indicator subscribes to live inserts on
-- this table, same postgres_changes pattern staff_messages already uses
-- (migration 0008). Without this, the subscription is a silent no-op --
-- nothing errors, it just never fires.
alter publication supabase_realtime add table public.admissions_notifications;
