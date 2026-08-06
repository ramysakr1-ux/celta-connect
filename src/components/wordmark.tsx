import { useId } from "react";

// Real brand mark, from Ramy's design handoff (design_handoff_connect_celta_logo,
// v2 "warm" palette -- confirmed as the approved one: the palette sample he
// sent renders at #FCF5E9, an exact match for v2's Panel token, not v1's).
// The monogram is inline SVG (exact path data from the handoff spec, not a
// raster crop) so it stays crisp at every size and can be recolored for the
// reversed/on-dark variant. "Connect" uses Instrument Serif italic and
// "CELTA" uses Instrument Sans -- both loaded in layout.tsx as CSS
// variables scoped to this component only; the rest of the app keeps
// Newsreader/Karla untouched.
const WARM = {
  gold: "#B3762B",
  ink: "#1C1710",
  goldOnDark: "#E0AC55",
  inkOnDarkGround: "#FCF5E9",
  muted: "rgba(28,23,16,0.6)",
};

// mark viewBox is `8 30 104 60` per spec -- aspect ratio 104:60 (1.7333).
const MARK_ASPECT = 104 / 60;

// Gentle dimensional treatment (6 Aug 2026, on request: "smaller and 3D") --
// a diagonal light-to-dark gradient per ring simulates a rounded/glossy
// tube catching light, plus a soft drop shadow for lift off the page.
// Kept subtle deliberately: this is a wordmark seen constantly in a header,
// not a hero graphic -- heavy bevel/highlight effects would get old fast.
function Mark({ heightPx, onDark }: { heightPx: number; onDark: boolean }) {
  const gradId = useId();
  const shadowId = useId();
  const widthPx = Math.round(heightPx * MARK_ASPECT);
  // Thinner than the original spec (was 14/11) -- on request, testing
  // whether a lighter ring weight (closer to the italic "Connect" script's
  // own stroke weight) reads as smoother, since a thick stroke on a small
  // circle radius has less room to anti-alias cleanly and exaggerates any
  // softness at the edge.
  const strokeWidth = heightPx < 40 ? 9 : 7.5;
  const goldBase = onDark ? WARM.goldOnDark : WARM.gold;
  const inkBase = onDark ? WARM.inkOnDarkGround : WARM.ink;

  return (
    <svg
      viewBox="8 30 104 60"
      width={widthPx}
      height={heightPx}
      fill="none"
      shapeRendering="geometricPrecision"
      role="img"
      aria-label="Connect CELTA"
      className="wordmark-spin"
    >
      <defs>
        <linearGradient id={`${gradId}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={mix(goldBase, "#ffffff", 0.35)} />
          <stop offset="55%" stopColor={goldBase} />
          <stop offset="100%" stopColor={mix(goldBase, "#000000", 0.32)} />
        </linearGradient>
        <linearGradient id={`${gradId}-ink`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={mix(inkBase, "#ffffff", onDark ? 0.15 : 0.28)} />
          <stop offset="55%" stopColor={inkBase} />
          <stop offset="100%" stopColor={mix(inkBase, "#000000", onDark ? 0.2 : 0.32)} />
        </linearGradient>
        <filter id={shadowId} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="1.4"
            stdDeviation="1.6"
            floodColor={WARM.ink}
            floodOpacity="0.28"
          />
        </filter>
      </defs>
      <g filter={`url(#${shadowId})`}>
        <path
          d="M56.1 42.2 A 24 24 0 1 0 56.1 77.8"
          stroke={`url(#${gradId}-gold)`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d="M96.1 42.2 A 24 24 0 1 0 96.1 77.8"
          stroke={`url(#${gradId}-ink)`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

// Tiny local hex mixer -- avoids pulling in a color library for two blends.
function mix(hex: string, withHex: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(withHex);
  const r = Math.round(a.r + (b.r - a.r) * amount);
  const g = Math.round(a.g + (b.g - a.g) * amount);
  const bl = Math.round(a.b + (b.b - a.b) * amount);
  return `rgb(${r}, ${g}, ${bl})`;
}
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const SIZE_CONFIG = {
  // Below-minimum header lockup -- sized down ~20% from spec minimum on
  // request ("a bit smaller"). markHeight 19, not 21: the spec's own two
  // lockup configs hold a mark-height:Connect-fontsize ratio of ~1.19-1.21
  // (58/48, 38/32); 21 gave this size a 1.31 ratio, a real outlier vs md/lg
  // below which already track the spec ratio closely -- not just "feels
  // big", it measurably was, relative to the rest of the system.
  // descriptorPx 4, not the spec ratio's ~3.2 (0.2 x connectPx): a hair
  // above strict ratio for legibility at this scale.
  sm: { markHeight: 19, connectPx: 16, celtaPx: 8, descriptorPx: 4 },
  // Config B, compact horizontal.
  md: { markHeight: 31, connectPx: 26, celtaPx: 11, descriptorPx: 6 },
  // Config A, full horizontal.
  lg: { markHeight: 47, connectPx: 39, celtaPx: 16, descriptorPx: 8 },
};

export function Wordmark({
  size = "md",
  onDark = false,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
  className?: string;
}) {
  const cfg = SIZE_CONFIG[size];
  const showDescriptor = cfg.descriptorPx > 0;
  const inkColor = onDark ? WARM.inkOnDarkGround : WARM.ink;
  const goldColor = onDark ? WARM.goldOnDark : WARM.gold;

  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: 2 }}>
      <span className="wordmark-mark-stage inline-flex">
        <Mark heightPx={cfg.markHeight} onDark={onDark} />
      </span>
      {/* Column scoped to the wordmark text only (not the mark) -- the
          descriptor below anchors to THIS column's own left edge, i.e. the
          "C" of Connect, rather than the mark's, which is what "aligns to
          the C stem" in the handoff actually meant. Was a sibling of the
          whole mark+text row before, so its padding-left was offset from
          the mark's edge, not Connect's -- a real misalignment, not a
          styling nicety. */}
      <span className="inline-flex flex-col">
        <span className="inline-flex items-baseline" style={{ gap: Math.round(cfg.celtaPx * 0.5) }}>
          <span
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontStyle: "italic",
              fontSize: cfg.connectPx,
              lineHeight: 0.9,
              letterSpacing: "-0.01em",
              color: goldColor,
            }}
          >
            Connect
          </span>
          <span
            style={{
              fontFamily: "var(--font-instrument-sans)",
              fontWeight: 600,
              fontSize: cfg.celtaPx,
              letterSpacing: "0.1em",
              color: inkColor,
            }}
          >
            CELTA
          </span>
        </span>
        {showDescriptor ? (
          <span
            style={{
              fontFamily: "var(--font-instrument-sans)",
              fontWeight: 500,
              fontSize: cfg.descriptorPx,
              letterSpacing: "0.26em",
              color: onDark ? "rgba(252,245,233,0.7)" : WARM.muted,
              textTransform: "uppercase",
              paddingLeft: 2,
            }}
          >
            Teacher Training Ecosystem
          </span>
        ) : null}
      </span>
    </span>
  );
}
