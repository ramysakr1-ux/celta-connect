import { ImageResponse } from "next/og";

// The wordmark's tile *is* the app icon now (specs/rename-to-connect.md):
// same square, same two-arc mark, for favicon/avatar/touch-icon alike.
// This is a separate, parallel implementation from src/components/wordmark.tsx
// rather than a reuse of it -- Satori (the renderer behind ImageResponse)
// has no access to the page's CSS custom properties, so the tile/arc colors
// below are the same tokens' literal hex equivalents (computed once via the
// standard OKLCH->sRGB conversion), not var(--color-*) references.
const INK_WARM = "#3e2818"; // --color-ink-warm, oklch(30% 0.042 58)
const LIFTED_GOLD = "#cc9140"; // bespoke lifted gold, oklch(70% 0.12 72)
const CARD = "#fefdfa"; // --color-card, oklch(99.5% 0.004 90)

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7, // ~0.22 x 32
        }}
      >
        <svg width="20" height="12" viewBox="8 30 104 60" fill="none">
          <path
            d="M56.1 42.2 A 24 24 0 1 0 56.1 77.8"
            stroke={LIFTED_GOLD}
            strokeWidth={13}
            strokeLinecap="round"
          />
          <path
            d="M96.1 42.2 A 24 24 0 1 0 96.1 77.8"
            stroke={CARD}
            strokeWidth={13}
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
