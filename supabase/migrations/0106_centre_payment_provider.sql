-- Payment provider connection (spec 2026-08-16, Payments.dc.html screen 1c).
--
-- "The centre connects its own provider account. Connect stores only a
-- reference to each transaction" -- so what lives here is the centre's CHOICE
-- and whether it has been connected, never a key, never a secret, and
-- certainly nothing in PCI scope. Credentials belong in the provider's own
-- onboarding and, for anything the server needs, in environment config.
--
-- "Only one provider can be connected at a time per centre (switching
-- providers is a deliberate re-connect, not a multi-provider setup)" -- hence
-- a single column rather than a join table.
--
-- Card is one of four accepted methods (bank transfer, cash, card,
-- employer/sponsor invoice) and is never required, so this staying null is a
-- perfectly normal centre, not an unfinished one.
alter table public.centers add column payment_provider text check (payment_provider in (
  'stripe', 'iyzico', 'paytr', 'mollie', 'adyen'
));

-- Null while a provider is chosen but onboarding hasn't completed -- the spec
-- gates the Connect button behind the provider's own OAuth/API-key flow, so
-- "selected" and "connected" are genuinely different states and the UI must be
-- able to tell them apart.
alter table public.centers add column payment_provider_connected_at timestamptz;
alter table public.centers add column payment_provider_connected_by uuid references public.profiles (id);
