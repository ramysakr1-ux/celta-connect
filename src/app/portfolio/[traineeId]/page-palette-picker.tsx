"use client";

import { useState } from "react";
import { setPagePalette } from "@/app/portfolio/[traineeId]/notebook-actions";
import { Avatar } from "@/components/avatar";
import { PAGE_PALETTES, PAGE_PALETTE_LABEL, pagePaletteVars, type PagePalette } from "@/lib/trainee-notebook";

// Ramy, 12 Sep 2026: "instead of having that colour palette next to the
// avatar, why not make the avatar the colour palette? You click on it and it
// changes colour -- you don't even have to open anything." So the avatar is
// the control: each click moves to the next paper -- Linen, Sky, Sage, Rose,
// Lavender, round again -- the page takes it at once, the avatar tile takes
// the same hue (at the avatar's own depth, so the initials stay readable),
// and the choice is saved. On Linen the tile is the person's own colour, as
// everywhere else in Connect.

const AVATAR_TONE: Record<PagePalette, string | undefined> = {
  linen: undefined,
  sky: "oklch(45% 0.10 235)",
  sage: "oklch(45% 0.10 160)",
  rose: "oklch(45% 0.10 350)",
  lavender: "oklch(45% 0.10 300)",
};

export function AvatarPaletteButton({ name, current }: { name: string; current: PagePalette }) {
  const [palette, setPalette] = useState<PagePalette>(current);

  const cycle = () => {
    const next = PAGE_PALETTES[(PAGE_PALETTES.indexOf(palette) + 1) % PAGE_PALETTES.length];
    setPalette(next);
    const surface = document.getElementById("trainee-surface");
    if (surface) {
      for (const k of ["--color-background", "--color-frame", "--color-card", "--color-card-inset", "--color-surface-muted", "--color-border"]) {
        surface.style.removeProperty(k);
      }
      for (const [k, v] of Object.entries(pagePaletteVars(next))) surface.style.setProperty(k, v);
    }
    void setPagePalette(next);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Page colour: ${PAGE_PALETTE_LABEL[palette]}. Click for the next.`}
      title={`Page colour · ${PAGE_PALETTE_LABEL[palette]} · click to change`}
      className="rounded-[8px] transition-transform hover:scale-105"
    >
      <Avatar name={name} size="xs" tone={AVATAR_TONE[palette]} />
    </button>
  );
}
