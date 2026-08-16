// Real brand mark, redesigned per specs/rename-to-connect.md (locked 7 Aug
// 2026): a single "Connect" word inside a filled ink tile is the mark now
// -- the tile is what makes the gold read at every size (gold-on-ink, not
// gold-on-cream), and the tile alone doubles as the app icon (see
// src/app/icon.tsx). Arc geometry is byte-for-byte unchanged from the
// original handoff (same viewBox, same path data) -- only the surrounding
// tile, sizing, and stroke-width compensation are new. Colors are real CSS
// custom properties now (--color-gold / --color-ink-warm / --color-card),
// not the standalone hex palette this component used to carry -- that
// disconnect from the app's own design tokens is exactly what the rename
// spec called out to fix.

// Bespoke "lifted gold" used only for the arcs sitting directly on the dark
// ink tile, and for the word when the whole lockup is reversed onto ink --
// needs more lift than the normal --color-gold to read at that contrast.
// Not a general design token, per spec -- kept local to this component.
const LIFTED_GOLD = "oklch(70% 0.12 72)";

// mark viewBox is `8 30 104 60` per the original handoff spec, unchanged --
// aspect ratio 104:60 (1.7333).
const MARK_ASPECT = 104 / 60;

// Stroke-width compensation as the tile shrinks, per spec's three anchor
// points (11 at 78px, 13 at 34px, 15 at 22px) -- linear interpolation
// between them, clamped flat beyond either end (spec gives no data point
// past 78px, and 22px is already the smallest named context).
function strokeWidthForTile(tilePx: number): number {
  const points: [number, number][] = [
    [22, 15],
    [34, 13],
    [78, 11],
  ];
  if (tilePx <= points[0][0]) return points[0][1];
  if (tilePx >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (tilePx >= x0 && tilePx <= x1) {
      const t = (tilePx - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return 12;
}

// Arcs always invert inside the tile -- first arc lifted gold, second arc
// --color-card -- regardless of onDark (per spec: "Reversed... arcs
// unchanged"). The tile background is what changes for onDark, not the
// arcs.
function Mark({ tilePx, spin = true }: { tilePx: number; spin?: boolean }) {
  const markWidth = tilePx * 0.63;
  const markHeight = markWidth / MARK_ASPECT;
  const strokeWidth = strokeWidthForTile(tilePx);

  return (
    <svg
      viewBox="8 30 104 60"
      width={markWidth}
      height={markHeight}
      fill="none"
      shapeRendering="geometricPrecision"
      role="img"
      aria-label="Connect"
      className={spin ? "wordmark-spin" : undefined}
    >
      <path
        d="M56.1 42.2 A 24 24 0 1 0 56.1 77.8"
        stroke={LIFTED_GOLD}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M96.1 42.2 A 24 24 0 1 0 96.1 77.8"
        stroke="var(--color-card)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export type WordmarkSize = "header" | "hero" | "stacked" | "email" | "icon";

// Literal per-context Tile/Word pixel pairs, straight from the spec's own
// "Sizes" table -- not re-derived from the "≈0.56 x tile" ratio it also
// gives, since that ratio doesn't quite reproduce the table's own numbers
// (it's a rule of thumb the designer used while drafting, not a formula to
// recompute live) and the table is explicitly "locked... every decision
// below is settled." Hero uses the midpoint of its 78-92/44-54 ranges,
// since (unlike the other rows) it's given as a range, not one number.
const SIZE_CONFIG: Record<WordmarkSize, { tile: number; word: number | null; descriptor: boolean; stacked: boolean }> = {
  header: { tile: 34, word: 22, descriptor: false, stacked: false },
  hero: { tile: 84, word: 49, descriptor: true, stacked: false },
  stacked: { tile: 54, word: 27, descriptor: true, stacked: true },
  email: { tile: 44, word: 26, descriptor: true, stacked: false },
  icon: { tile: 32, word: null, descriptor: false, stacked: false },
};

export function Wordmark({
  size = "hero",
  onDark = false,
  className = "",
  iconSizePx,
  spin = true,
}: {
  size?: WordmarkSize;
  onDark?: boolean;
  className?: string;
  /** A document is not an app -- the getting-started letter wants the mark still. */
  spin?: boolean;
  /** Only used with size="icon" -- overrides the tile's default 32px (spec's icon range is 22-48px, context-dependent, e.g. the 20px designer-credit mark). */
  iconSizePx?: number;
}) {
  const cfg = SIZE_CONFIG[size];
  const tilePx = size === "icon" && iconSizePx ? iconSizePx : cfg.tile;
  const tileRadius = Math.round(tilePx * 0.22);
  const tileBg = onDark ? "oklch(30% 0.02 65)" : "var(--color-ink-warm)";
  const wordColor = onDark ? LIFTED_GOLD : "var(--color-gold)";

  const tile = (
    <span
      className="wordmark-mark-stage inline-flex shrink-0 items-center justify-center"
      style={{ width: tilePx, height: tilePx, borderRadius: tileRadius, background: tileBg }}
    >
      <Mark tilePx={tilePx} spin={spin} />
    </span>
  );

  if (cfg.word === null) {
    return <span className={`inline-flex ${className}`}>{tile}</span>;
  }

  const wordPx = cfg.word;
  // Descriptor font-size ~0.2x the word size, with a hard 9px floor -- this
  // formula, applied to the table's own literal word sizes, reproduces the
  // spec's explicit "Email header ... yes, 9px" cell exactly (26 * 0.2 =
  // 5.2, floored to 9), confirming the two parts of the spec agree.
  const descriptorPx = Math.max(9, Math.round(wordPx * 0.2));
  const descriptorTracking = wordPx < 40 ? "0.24em" : "0.26em";
  // "padding-left: 9px at the reference size (44px word) -- scale that
  // offset with the word."
  const paddingLeftPx = Math.round((9 * wordPx) / 44);
  // "Tile-to-text gap 15px at the 78px tile" -- scales with the tile.
  const gapPx = Math.round((15 * tilePx) / 78);

  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: gapPx }}>
      {tile}
      <span className="inline-flex flex-col">
        <span
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontStyle: "italic",
            fontSize: wordPx,
            lineHeight: 0.85,
            letterSpacing: "-0.012em",
            color: wordColor,
          }}
        >
          Connect
        </span>
        {cfg.descriptor ? (
          <span
            style={{
              fontFamily: "var(--font-instrument-sans)",
              fontWeight: 600,
              fontSize: descriptorPx,
              letterSpacing: descriptorTracking,
              color: onDark ? "rgba(252,245,233,0.7)" : "var(--color-muted)",
              textTransform: "uppercase",
              paddingLeft: paddingLeftPx,
              marginTop: 7,
              whiteSpace: cfg.stacked ? "normal" : "nowrap",
            }}
          >
            Teacher training platform
          </span>
        ) : null}
      </span>
    </span>
  );
}
