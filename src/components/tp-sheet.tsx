"use client";

import type React from "react";
import { DictateButton } from "@/components/dictate-anywhere";
import { BAND, BAND_TEXT, BAR_BORDER, CARD, FAINT, GOLD_INK, INK, MUTED, SHEET, type BandRole } from "@/lib/sheet-tokens";

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

export {
  SHEET,
  BAND_TEXT,
  TEAL,
  TEAL_HOVER,
  GOLD,
  GOLD_INK,
  GOLD_WASH,
  INK_WARM,
  GARNET,
  GARNET_HOVER,
  DESTRUCTIVE,
  MUTED,
  INK,
  CARD,
  INSET,
  BORDER,
  FAINT,
  ZEBRA,
  BAR_BORDER,
  PLACEHOLDER,
  BAND,
} from "@/lib/sheet-tokens";
export type { BandRole } from "@/lib/sheet-tokens";

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

export function SaveStatusPill({
  role,
  label,
  dot = "oklch(80% 0.1 80)",
}: {
  role: BandRole;
  label: string;
  /** Overridden for a state that is not "working": grey while an assignment
   *  has not opened for writing yet (assignments handoff §7). */
  dot?: string;
}) {
  return (
    <span className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: BAND[role].status }}>
      <span className="size-[5px] rounded-full" style={{ background: dot }} />
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
