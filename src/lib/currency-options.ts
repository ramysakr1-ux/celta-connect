// The currency codes an offer can be priced in.
//
// Remainder pass A4 (16 Sep 2026): the offer form took the currency as a
// free-text `maxLength={3}` box with a "GBP" placeholder, so one slip turned a
// fee into "GPB" -- a code nothing formats, on a document that goes to an
// applicant. The centre already stores its own `currency`, so the box is a
// select seeded with it.
//
// Deliberately a short list rather than all 180 ISO codes: these are the ones
// CELTA centres price in, and `centreCurrency` is always offered first even
// when it is not on the list, so no centre is locked out of its own money.
const COMMON = [
  "GBP",
  "EUR",
  "USD",
  "TRY",
  "AED",
  "SAR",
  "EGP",
  "AUD",
  "CAD",
  "CHF",
  "JPY",
  "INR",
  "MXN",
  "BRL",
  "PLN",
  "THB",
  "VND",
  "ZAR",
] as const;

/** The centre's own currency first, then the rest, with no duplicates. */
export function currencyChoices(centreCurrency: string | null | undefined): string[] {
  const own = centreCurrency && /^[A-Z]{3}$/i.test(centreCurrency) ? centreCurrency.toUpperCase() : null;
  return own ? [own, ...COMMON.filter((c) => c !== own)] : [...COMMON];
}
