/**
 * Money that may not all be in one currency.
 *
 * Both money screens in Centre Management summed every amount into a single
 * number and then chose a currency symbol for it -- from centers.currency,
 * or a fallback when that is unset. On the demo centre alone that turned
 * $4,200 plus £2,000 into "$6,200" on the Centre overview and, with Los
 * Angeles added, into "£8,000" on the owner's landing: the same money, two
 * screens, two different currencies, and neither figure a real amount of
 * anything (walked 15 Sep 2026).
 *
 * A centre can legitimately hold more than one: courses.fee_currency is
 * per course, payments carry their own currency, and an owner's branches
 * need not agree. So the total is a total PER currency, and the screens say
 * so. With one currency -- which is the ordinary case -- this renders
 * exactly what it rendered before.
 */
export interface CurrencyTotal {
  currency: string;
  total: number;
}

export function sumByCurrency(
  rows: { amount: number | string | null; currency: string | null }[],
  fallbackCurrency: string | null | undefined
): CurrencyTotal[] {
  const code = (c: string | null) => (c && /^[A-Z]{3}$/i.test(c) ? c.toUpperCase() : null);
  const fallback = code(fallbackCurrency ?? null) ?? "GBP";
  const byCurrency = new Map<string, number>();
  for (const r of rows) {
    const c = code(r.currency) ?? fallback;
    byCurrency.set(c, (byCurrency.get(c) ?? 0) + Number(r.amount ?? 0));
  }
  return [...byCurrency.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total || a.currency.localeCompare(b.currency));
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * One line for a figure that may span currencies: "$4,200 · £2,000".
 * Empty input reads as zero in the centre's own currency, so a card never
 * renders blank.
 */
export function formatTotals(totals: CurrencyTotal[], fallbackCurrency: string | null | undefined): string {
  if (totals.length === 0) {
    const fallback = fallbackCurrency && /^[A-Z]{3}$/i.test(fallbackCurrency) ? fallbackCurrency.toUpperCase() : "GBP";
    return formatCurrency(0, fallback);
  }
  return totals.map((t) => formatCurrency(t.total, t.currency)).join(" · ");
}

/** True when a figure is made of more than one currency, so a screen can say so. */
export function isMixed(totals: CurrencyTotal[]): boolean {
  return totals.length > 1;
}
