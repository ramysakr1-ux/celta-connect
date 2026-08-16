// The five providers a centre may connect (spec 2026-08-16, Payments.dc.html
// screen 1c). Card is one of four accepted methods -- bank transfer, cash,
// card, employer/sponsor invoice -- and is never required, so a centre with
// none of these connected is a normal centre.
//
// `dot` colours are decorative and brand-adjacent, explicitly NOT semantic --
// they identify a provider, they don't indicate status.

export const PAYMENT_PROVIDERS = [
  {
    key: "stripe",
    name: "Stripe",
    region: "Global",
    note: "Cards, wallets, most currencies",
    dot: "oklch(55% 0.17 285)",
    // The only one with an adapter written (src/lib/payments/stripe-adapter.ts).
    // Even this has never run against real Stripe -- no key in the environment.
    adapter: true,
  },
  {
    key: "iyzico",
    name: "iyzico",
    region: "Turkey",
    note: "Cards, instalments",
    dot: "oklch(62% 0.16 40)",
    adapter: false,
  },
  { key: "paytr", name: "PayTR", region: "Turkey", note: "Cards, local methods", dot: "oklch(58% 0.13 150)", adapter: false },
  { key: "mollie", name: "Mollie", region: "Europe", note: "Cards, iDEAL, SEPA", dot: "oklch(60% 0.15 25)", adapter: false },
  { key: "adyen", name: "Adyen", region: "Global", note: "Cards, enterprise", dot: "oklch(52% 0.11 200)", adapter: false },
] as const;

export type PaymentProviderKey = (typeof PAYMENT_PROVIDERS)[number]["key"];

export function providerByKey(key: string | null | undefined) {
  return PAYMENT_PROVIDERS.find((p) => p.key === key) ?? null;
}
