"use client";

import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { areaClassFor } from "@/app/dashboard/area-theme";

/**
 * The wordmark, reversed when it is sitting on a coloured band.
 *
 * The tile is normally ink-warm so its gold arcs read against it. On a band a
 * fixed dark tile just muddies into the colour behind it, so it becomes a
 * translucent tint of the band's own text colour instead -- the same solution
 * the volunteer pool header already uses, and the reason option B works here
 * while tinting the tile on a LIGHT header did not: gold on bronze goes flat,
 * gold on a translucent white tile over bronze does not.
 */
export function AreaWordmark({ size = "header" }: { size?: "header" | "header-compact" }) {
  const onBand = areaClassFor(usePathname() ?? "") !== null;
  return onBand ? (
    <Wordmark size={size} onDark tileBg="color-mix(in oklab, oklch(97% 0.008 88) 22%, transparent)" />
  ) : (
    <Wordmark size={size} />
  );
}
