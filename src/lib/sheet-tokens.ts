// The colour tokens and band palettes of the TP/assignment document system.
//
// Split out of tp-sheet.tsx on 13 Sep 2026 because that file is "use client",
// and every export of a client module reaches a SERVER component as a client
// reference, not as its value. The tutor assignments board is a server
// component and read `BAND.teal.fill` off one of those proxies, which is
// undefined -- "Cannot read properties of undefined (reading 'fill')", a
// runtime 500 that a clean typecheck and a clean build both let through.
//
// Plain values live here, with no directive, so either side can import them.
// tp-sheet re-exports them, so every client component that already imports
// from there is untouched.

export const SHEET = "oklch(99.2% 0.005 90)";
export const BAND_TEXT = "oklch(98.5% 0.006 90)";
export const TEAL = "oklch(37.5% 0.058 195)";
export const TEAL_HOVER = "oklch(33% 0.058 195)";
export const GOLD = "oklch(63% 0.096 72)";
export const GOLD_INK = "oklch(44% 0.095 68)";
export const GOLD_WASH = "oklch(94.5% 0.065 85)";
export const INK_WARM = "oklch(30% 0.042 58)";
export const GARNET = "oklch(42% 0.13 27)";
export const GARNET_HOVER = "oklch(37% 0.13 27)";
export const DESTRUCTIVE = "oklch(52% 0.19 32)";
export const MUTED = "var(--color-muted)";
export const INK = "var(--color-ink)";
export const CARD = "var(--color-card)";
export const INSET = "var(--color-card-inset)";
export const BORDER = "var(--color-border)";
export const FAINT = "var(--color-border-faint)";
export const ZEBRA = "oklch(97.6% 0.01 88)";
export const BAR_BORDER = "oklch(83% 0.028 78)";
export const PLACEHOLDER = "oklch(64% 0.015 70)";

export type BandRole = "teal" | "garnet" | "ink-warm" | "gold-ink";

/** Each band's own tints. Never mix one band's with another's. */
export const BAND: Record<
  BandRole,
  { fill: string; eyebrow: string; sub: string; status: string; dictateFill: string; dictateText: string; submit: string; submitHover: string }
> = {
  teal: {
    fill: TEAL,
    eyebrow: "oklch(84% 0.05 195)",
    sub: "oklch(86% 0.04 195)",
    status: "oklch(86% 0.04 195)",
    dictateFill: "oklch(86% 0.06 195)",
    dictateText: "oklch(26% 0.05 195)",
    submit: TEAL,
    submitHover: TEAL_HOVER,
  },
  garnet: {
    fill: GARNET,
    eyebrow: "oklch(86% 0.06 40)",
    sub: "oklch(90% 0.035 40)",
    status: "oklch(88% 0.04 40)",
    dictateFill: "oklch(90% 0.05 40)",
    dictateText: GARNET,
    submit: GARNET,
    submitHover: GARNET_HOVER,
  },
  "ink-warm": {
    fill: INK_WARM,
    eyebrow: "oklch(79% 0.06 78)",
    sub: "oklch(82% 0.03 78)",
    status: "oklch(82% 0.03 78)",
    dictateFill: "oklch(86% 0.09 82)",
    dictateText: INK_WARM,
    submit: TEAL,
    submitHover: TEAL_HOVER,
  },
  "gold-ink": {
    fill: GOLD_INK,
    eyebrow: "oklch(90% 0.06 80)",
    sub: "oklch(92% 0.05 80)",
    status: "oklch(92% 0.05 80)",
    dictateFill: "oklch(92% 0.05 80)",
    dictateText: GOLD_INK,
    submit: TEAL,
    submitHover: TEAL_HOVER,
  },
};
