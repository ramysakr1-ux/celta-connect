-- Connect is an international platform, not a Turkish one (Ramy, 2026-08-16),
-- so the provider list widens from five to nine: global first, then Europe,
-- then country-specific.
--
-- PayPal earns its place on recognition alone -- it is the one a candidate
-- anywhere will already have. GoCardless is here for a different reason: it is
-- bank debit rather than cards, which fits an instalment plan better than a
-- one-off card charge does.
--
-- Wise was considered and deliberately left out. It is a transfer rail, not a
-- card acquirer: there is no hosted checkout page and no payment webhook to
-- confirm. Money arriving via Wise is a bank transfer, which the manual
-- "marked by [name]" path already covers. Making it a tenth option here would
-- imply card payment it cannot provide. Matching incoming Wise transfers to
-- expected instalments is a reconciliation feature, a different shape from
-- these adapters, and belongs in its own build.

alter table public.centers drop constraint if exists centers_payment_provider_check;
alter table public.centers add constraint centers_payment_provider_check check (payment_provider in (
  'stripe',
  'paypal',
  'adyen',
  'checkout_com',
  'mollie',
  'gocardless',
  'square',
  'iyzico',
  'paytr'
));
