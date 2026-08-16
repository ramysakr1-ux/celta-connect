// The payment providers a centre may connect (spec 2026-08-16,
// Payments.dc.html screen 1c; list widened 2026-08-16 on Ramy's note that
// Connect is an international platform, not a Turkish one).
//
// Ordered global first, then Europe, then country-specific -- a centre scans
// for its own region rather than reading an alphabetical list.
//
// Card is one of four accepted methods -- bank transfer, cash, card,
// employer/sponsor invoice -- and is never required, so a centre with none of
// these connected is a perfectly normal centre.
//
// `dot` colours are decorative and brand-adjacent, explicitly NOT semantic:
// they identify a provider. The working/not-working light is the semantic one.
//
// Availability and feature sets change; treat the region and notes as a guide
// for a centre choosing, not as a guarantee they can sign up today.

export const PAYMENT_PROVIDERS = [
  {
    key: "stripe",
    name: "Stripe",
    region: "Global",
    note: "Cards, wallets, most currencies",
    dot: "oklch(55% 0.17 285)",
    // The only one with an adapter written (src/lib/payments/stripe-adapter.ts),
    // and even it has never run -- no key in the environment.
    adapter: true,
  },
  {
    key: "paypal",
    name: "PayPal",
    region: "Global",
    note: "Cards and PayPal balance — the one candidates recognise",
    dot: "oklch(52% 0.14 250)",
    adapter: false,
  },
  {
    key: "adyen",
    name: "Adyen",
    region: "Global",
    note: "Cards, enterprise-scale, strong in Europe",
    dot: "oklch(52% 0.11 200)",
    adapter: false,
  },
  {
    key: "checkout_com",
    name: "Checkout.com",
    region: "Global",
    note: "Cards, UK and Europe focus",
    dot: "oklch(56% 0.13 300)",
    adapter: false,
  },
  {
    key: "mollie",
    name: "Mollie",
    region: "Europe",
    note: "Cards, iDEAL, SEPA, Bancontact",
    dot: "oklch(60% 0.15 25)",
    adapter: false,
  },
  {
    key: "gocardless",
    name: "GoCardless",
    region: "UK, Europe, US",
    note: "Bank debit — built for instalments rather than one-off cards",
    dot: "oklch(58% 0.14 160)",
    adapter: false,
  },
  {
    key: "square",
    name: "Square",
    region: "US, UK, Canada, Australia",
    note: "Cards, common for smaller centres",
    dot: "oklch(45% 0.02 250)",
    adapter: false,
  },
  {
    key: "iyzico",
    name: "iyzico",
    region: "Turkey",
    note: "Cards, instalments",
    dot: "oklch(62% 0.16 40)",
    adapter: false,
  },
  {
    key: "paytr",
    name: "PayTR",
    region: "Turkey",
    note: "Cards, local methods",
    dot: "oklch(58% 0.13 150)",
    adapter: false,
  },
] as const;

export type PaymentProviderKey = (typeof PAYMENT_PROVIDERS)[number]["key"];

export function providerByKey(key: string | null | undefined) {
  return PAYMENT_PROVIDERS.find((p) => p.key === key) ?? null;
}
