"use client";

import type React from "react";
import { DictateButton } from "@/components/dictate-anywhere";

// design_handoff_tp_feedback_cycle §0 — the primitives every screen in the TP
// cycle is built from, in one place so the four documents cannot drift apart.
//
// Ramy, 13 Sep 2026: "please pay attention to the headers and the colours."
// The headers are the thing that tells you which document you are in, and the
// handoff gives each one its own hue with its OWN set of tints for the eyebrow,
// the save status and the Dictate button sitting on it. Those tints are not
// interchangeable: teal's eyebrow on the garnet band reads green-grey. So a
// band is chosen by ROLE here and carries its whole palette with it.
//
//   teal      the tutor, structure, strengths   → Tutor feedback, Plan review
//   garnet    the trainee's own voice, teaching → Self-evaluation
//   ink-warm  planning, the written plan        → Lesson plan
//   gold-ink  language work, carry-forward      → Language analysis
//
// Neutrals go through the CSS tokens (they equal the handoff's literals
// exactly) so the candidate's chosen page palette still works; the role hues
// are literal, because they carry meaning rather than depth.

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

/** The paper the whole document sits on. */
export function TpSheet({
  maxWidth,
  children,
}: {
  maxWidth: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[14px] p-3 sm:p-5"
      style={{ background: "color-mix(in oklab, var(--color-background) 84%, var(--color-ink) 7%)" }}
    >
      <div
        className="mx-auto rounded-[14px]"
        style={{
          maxWidth,
          background: SHEET,
          boxShadow: "0 1px 2px oklch(23.5% 0.017 65 / 0.06), 0 18px 44px oklch(23.5% 0.017 65 / 0.12)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function IdentityBand({
  role,
  eyebrow,
  title,
  subLine,
  status,
  right,
  showDictate = true,
}: {
  role: BandRole;
  eyebrow: string;
  /** A string, or JSX when part of the title is tinted. */
  title: React.ReactNode;
  subLine?: string;
  status?: React.ReactNode;
  /** The step switcher, when the screen has one. Sits left of Dictate. */
  right?: React.ReactNode;
  showDictate?: boolean;
}) {
  const band = BAND[role];
  return (
    <div
      className="flex flex-wrap items-end justify-between gap-6 rounded-t-[14px]"
      style={{ background: band.fill, padding: "18px 26px 16px" }}
    >
      <div className="flex min-w-0 flex-col gap-[3px]">
        <p className="font-bold uppercase" style={{ fontSize: 10.5, letterSpacing: "0.16em", color: band.eyebrow }}>
          {eyebrow}
        </p>
        <h2 className="font-serif" style={{ fontSize: 29, fontWeight: 400, color: BAND_TEXT, lineHeight: 1.15 }}>
          {title}
        </h2>
        {subLine ? <p style={{ fontSize: 13, color: band.sub }}>{subLine}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {right}
        {status}
        {showDictate ? <DictateButton variant="band" fill={band.dictateFill} text={band.dictateText} /> : null}
      </div>
    </div>
  );
}

export function SaveStatusPill({ role, label }: { role: BandRole; label: string }) {
  return (
    <span className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: BAND[role].status }}>
      <span className="size-[5px] rounded-full" style={{ background: "oklch(80% 0.1 80)" }} />
      {label}
    </span>
  );
}

/** The card-fill strip that sits directly under a band. */
export function Strip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-6 ${className}`}
      style={{ background: CARD, borderBottom: `1px solid ${FAINT}`, padding: "13px 26px" }}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, colour = MUTED }: { children: React.ReactNode; colour?: string }) {
  return (
    <p className="font-bold uppercase" style={{ fontSize: 10.5, letterSpacing: "0.12em", color: colour }}>
      {children}
    </p>
  );
}

/** 3×12 colour marker + uppercase label, the section heading used throughout. */
export function MarkerLabel({ colour, label }: { colour: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ width: 3, height: 12, borderRadius: 2, background: colour, display: "inline-block" }} />
      <span className="uppercase" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: colour }}>
        {label}
      </span>
    </div>
  );
}

export function NumberedDot({
  n,
  hue,
  done,
  size = 24,
}: {
  n: number | string;
  hue: string;
  done: boolean;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        border: `2px solid ${hue}`,
        background: done ? hue : SHEET,
        color: done ? SHEET : MUTED,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {n}
    </span>
  );
}

/**
 * The bar at the foot of every editor. Sticky rather than viewport-fixed: each
 * of these forms is one section of a longer page, so a fixed bar would sit over
 * whatever follows it for as long as the page was open.
 */
export function BottomBar({
  role,
  warning,
  children,
}: {
  role: BandRole;
  warning: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="sticky bottom-40 z-20 mt-3 flex flex-wrap items-center justify-between gap-3 md:bottom-4"
      style={{
        border: `1px solid ${BAR_BORDER}`,
        borderRadius: 10,
        background: "color-mix(in oklab, var(--color-card-inset) 94%, transparent)",
        backdropFilter: "blur(6px)",
        padding: "11px 24px",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="size-[5px] shrink-0 rounded-full" style={{ background: GOLD_INK }} />
        <p style={{ fontSize: 11.5, color: GOLD_INK }}>{warning}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="mr-2">
          <DictateButton variant="bar" hue={BAND[role].submit} />
        </span>
        {children}
      </div>
    </div>
  );
}

export function SaveDraftButton({ pending, disabled }: { pending: boolean; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        borderRadius: 8,
        border: `1px solid ${BAR_BORDER}`,
        background: SHEET,
        padding: "8px 15px",
        fontSize: 13.5,
        color: INK,
      }}
    >
      {pending ? "Saving…" : "Save draft"}
    </button>
  );
}

export function SubmitButton({
  role,
  label,
  pending,
  disabled,
  formAction,
}: {
  role: BandRole;
  label: string;
  pending: boolean;
  disabled?: boolean;
  formAction?: (formData: FormData) => void;
}) {
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={disabled}
      style={{
        borderRadius: 8,
        background: BAND[role].submit,
        padding: "8px 17px",
        fontWeight: 600,
        fontSize: 13.5,
        color: BAND_TEXT,
      }}
    >
      {pending ? "Submitting…" : label}
    </button>
  );
}

/** Borderless autosizing field, the default across every one of these screens. */
export function plainField(size: number, colour: string = INK, lineHeight = 1.55): React.CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    border: "none",
    background: "transparent",
    padding: 0,
    fontSize: size,
    lineHeight,
    color: colour,
    outline: "none",
    resize: "none",
    overflowY: "hidden",
    minHeight: "1.5em",
  };
}

/** Ruled variant — a coloured left rule, used where a field belongs to a hue. */
export function ruledField(size: number, rule: string, lineHeight = 1.6): React.CSSProperties {
  return {
    ...plainField(size, INK, lineHeight),
    borderLeft: `2px solid ${rule}`,
    padding: "2px 0 2px 14px",
  };
}
