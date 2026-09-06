"use client";

import { useState } from "react";

// The one thing the centre has to hand over by hand.
//
// Handbook 14.1 lists it among the four things a centre must do 2-3 days
// before the assessment -- "give the assessor the course notification
// reference number" -- and 15.2 says why it cannot be skipped: "The
// assessor's report is completed online via Appian and in order to access it
// for a particular course/centre, assessors need details of the notification
// reference number, which the centre should supply."
//
// So this sits at the top of the landing page rather than in the pack list.
// An assessor who lands here and cannot find it has to email the centre and
// wait, which is exactly the delay 14.1's deadline exists to prevent.
//
// Ramy, 30 Aug 2026: "make it clear when they land, so they can copy this
// course number and use it to access the course on Appian."

const GOLD = "oklch(60% 0.11 70)";

// The "Open Appian" buttons that used to sit in this card are gone.
//
// Ramy, 30 Aug 2026: "I also don't think we need to open Appian. There's one
// on top next to Download whole pack, that's enough, and then he also
// created another pill next to Copy. Not a big deal, but redundant."
//
// He is right -- this card's job is the reference number and how to use it,
// and the way into Appian is already a primary action at the top of the
// pack. Two doors to the same place, a few hundred pixels apart, is just
// something else to read.
export function AppianReference({ reference }: { reference: string | null }) {
  const [copied, setCopied] = useState(false);

  // No reference set. Say so plainly rather than hiding the block: an
  // assessor who knows the number is missing can ask for it, where one shown
  // nothing at all assumes Appian is simply broken.
  if (!reference) {
    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 16px", borderRadius: 7,
          background: "color-mix(in oklab, oklch(44% 0.1 68) 8%, var(--color-card))",
          border: "1px solid color-mix(in oklab, oklch(44% 0.1 68) 26%, transparent)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(44% 0.1 68)" }}>
          No Appian reference yet
        </span>
        <span style={{ fontSize: 12, color: "var(--color-ink)", flex: "1 1 240px", minWidth: 220 }}>
          The centre has not recorded the course notification reference number. You will need it from them to open your Assessor
          Report &mdash; Administration Handbook 15.2.
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "13px 16px", borderRadius: 7,
        background: `color-mix(in oklab, ${GOLD} 10%, var(--color-card))`,
        border: `1px solid color-mix(in oklab, ${GOLD} 32%, transparent)`,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "oklch(43% 0.09 70)" }}>
        Appian course reference
      </span>

      <code
        style={{
          fontSize: 15, fontWeight: 700, letterSpacing: "0.02em", color: "var(--color-ink)",
          fontVariantNumeric: "tabular-nums", userSelect: "all",
        }}
      >
        {reference}
      </code>

      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(reference).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            },
            () => undefined
          );
        }}
        style={{
          height: 28, padding: "0 12px", borderRadius: 999, cursor: "pointer",
          border: `1px solid color-mix(in oklab, ${GOLD} 45%, transparent)`,
          background: copied ? `color-mix(in oklab, ${GOLD} 26%, transparent)` : "var(--color-card)",
          color: "var(--color-ink)", fontSize: 11.5, fontWeight: 600,
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>


      <span style={{ fontSize: 12, color: "var(--color-muted)", flex: "1 1 240px", minWidth: 220 }}>
        Paste this into Appian to reach your Assessor Report for this course. It opens once the centre has submitted the Centre
        Grade form.
      </span>
    </div>
  );
}
