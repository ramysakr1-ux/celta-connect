"use client";

import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { setPagePalette } from "@/app/portfolio/[traineeId]/notebook-actions";
import { PAGE_PALETTES, PAGE_PALETTE_LABEL, pagePaletteSwatch, pagePaletteVars, type PagePalette } from "@/lib/trainee-notebook";

// Ramy, 12 Sep 2026: "personalised pages... I'll go with the first one" --
// paper, not a theme. A small palette button in the header corner; a row of
// five swatches; the page ground, frame and cards take the colour at once
// (the variables are set on the trainee surface directly, no reload) and the
// choice is saved to the trainee's settings for every page after.
export function PagePalettePicker({ current }: { current: PagePalette }) {
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState<PagePalette>(current);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (p: PagePalette) => {
    setPalette(p);
    const surface = document.getElementById("trainee-surface");
    if (surface) {
      for (const k of ["--color-background", "--color-frame", "--color-card", "--color-card-inset", "--color-surface-muted", "--color-border"]) {
        surface.style.removeProperty(k);
      }
      for (const [k, v] of Object.entries(pagePaletteVars(p))) surface.style.setProperty(k, v);
    }
    void setPagePalette(p);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Page colour"
        title="Page colour"
        className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-[oklch(98.5%_0.006_90_/_0.12)]"
        style={{ color: "oklch(78% 0.02 80)" }}
      >
        <Palette size={15} />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Page colour"
          className="absolute top-9 right-0 z-50 flex items-center gap-2 rounded-full px-3 py-2 shadow-[0_8px_24px_oklch(23.5%_0.017_65_/_0.22)]"
          style={{ background: "oklch(98.5% 0.006 90)", border: "1px solid oklch(88% 0.016 82)" }}
        >
          {PAGE_PALETTES.map((p) => (
            <button
              key={p}
              type="button"
              role="menuitemradio"
              aria-checked={p === palette}
              aria-label={`${PAGE_PALETTE_LABEL[p]} paper`}
              title={PAGE_PALETTE_LABEL[p]}
              onClick={() => choose(p)}
              className="size-6 rounded-full transition-transform hover:scale-110"
              style={{
                background: pagePaletteSwatch(p),
                border: `1.5px solid ${p === palette ? "oklch(23.5% 0.017 65)" : "oklch(80% 0.014 82)"}`,
                boxShadow: p === palette ? "0 0 0 2px oklch(98.5% 0.006 90), 0 0 0 3px oklch(23.5% 0.017 65)" : "none",
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
