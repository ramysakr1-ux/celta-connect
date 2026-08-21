import { ImageResponse } from "next/og";

// PWA manifest icon (512x512), used for both purpose="any" and
// purpose="maskable" (manifest.ts) -- so unlike icon.tsx/icon-192.png.tsx
// this one is full-bleed with no rounded corner of its own (the OS applies
// its own mask/rounding for maskable icons) and the mark is sized well
// inside the ~80% "safe zone" so a circular crop never clips it.
const INK_WARM = "#3e2818";
const LIFTED_GOLD = "#cc9140";
const CARD = "#f0e7d6"; // --color-card, oklch(93% 0.024 80)

const size = { width: 512, height: 512 };

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: INK_WARM,
        }}
      >
        <svg width="248" height="143" viewBox="8 30 104 60" fill="none">
          <path d="M56.1 42.2 A 24 24 0 1 0 56.1 77.8" stroke={LIFTED_GOLD} strokeWidth={13} strokeLinecap="round" />
          <path d="M96.1 42.2 A 24 24 0 1 0 96.1 77.8" stroke={CARD} strokeWidth={13} strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
