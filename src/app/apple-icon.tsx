import { ImageResponse } from "next/og";

// iOS "Add to Home Screen" home-screen icon (specs/build-spec.md §7). Apple's
// convention: no pre-applied corner radius or transparency -- iOS rounds it
// automatically, same reasoning as the maskable icon-512.png.tsx route.
const INK_WARM = "#3e2818";
const LIFTED_GOLD = "#cc9140";
const CARD = "#fcf4e8"; // --color-card, oklch(97% 0.018 80)

export const contentType = "image/png";
export const size = { width: 180, height: 180 };

export default function AppleIcon() {
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
        <svg width="106" height="61" viewBox="8 30 104 60" fill="none">
          <path d="M56.1 42.2 A 24 24 0 1 0 56.1 77.8" stroke={LIFTED_GOLD} strokeWidth={12} strokeLinecap="round" />
          <path d="M96.1 42.2 A 24 24 0 1 0 96.1 77.8" stroke={CARD} strokeWidth={12} strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
