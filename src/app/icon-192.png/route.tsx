import { ImageResponse } from "next/og";

// PWA manifest icon (192x192) -- same tile/mark design as src/app/icon.tsx
// (the 32px favicon), just a separate route since Next's icon.tsx file
// convention only supports one size per file and the manifest needs
// larger, standard PWA sizes (192/512). Literal sRGB hex equivalents of the
// same design tokens, computed and cross-checked against icon.tsx's own
// values -- see manifest.ts's comment.
const INK_WARM = "#3e2818";
const LIFTED_GOLD = "#cc9140";
const CARD = "#f0e7d6"; // --color-card, oklch(93% 0.024 80)

const size = { width: 192, height: 192 };

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
          borderRadius: 42, // ~0.22 x 192, same ratio as icon.tsx
        }}
      >
        <svg width="121" height="70" viewBox="8 30 104 60" fill="none">
          <path d="M56.1 42.2 A 24 24 0 1 0 56.1 77.8" stroke={LIFTED_GOLD} strokeWidth={11} strokeLinecap="round" />
          <path d="M96.1 42.2 A 24 24 0 1 0 96.1 77.8" stroke={CARD} strokeWidth={11} strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
