import type { CellCategory } from "@/lib/timetable-grid";

// The timetable's glass-card palette, in one place so every screen that shows
// "the timetable, coloured" reads from the same values. The read-only board
// (the 4-week grid) and Course Stream's "Your day" track both style their
// cards from this map -- Ramy, 11 Sep 2026: "the your day cards should be
// similar to the cards from the timetable... the same coloration and
// everything. It's basically the timetable of the day." Two copies would drift
// the moment one screen was retinted; one map cannot disagree with itself.

export type DisplayCategory = "wg" | "rm" | "admin" | "iw" | "lu";

// The spec's own 5-bucket model has no separate "consultation" category --
// `cs` (split out from `rm` in timetable-grid.ts) folds back into `iw` here
// ("Individual / bookable (consultations, own-time writing, Stage 3)").
export function toDisplayCategory(cat: CellCategory): DisplayCategory {
  return cat === "cs" ? "iw" : cat;
}

export interface CategoryStyle {
  accent: string;
  tintFrom: string;
  tintTo: string;
  label: string;
  titleWeight: number;
}

export const CATEGORY_STYLE: Record<DisplayCategory, CategoryStyle> = {
  wg: {
    accent: "oklch(38% 0.072 195)",
    tintFrom: "oklch(95.5% 0.03 195 / 0.75)",
    tintTo: "oklch(95.5% 0.03 195 / 0.35)",
    label: "Whole group — Zoom input",
    titleWeight: 500,
  },
  rm: {
    accent: "oklch(23.5% 0.017 65)",
    tintFrom: "oklch(100% 0 0 / 0.92)",
    tintTo: "oklch(100% 0 0 / 0.55)",
    label: "Group room — TP, feedback, planning",
    titleWeight: 600,
  },
  admin: {
    // Ramy's design file (29 Aug 2026) uses gold here, and gold is what the
    // 2026-08-21 colour audit had re-pointed to amber. His file is the
    // authority for this screen, so gold it is -- the legend swatch and the
    // card spine both read from this one value, so they cannot disagree.
    accent: "oklch(60% 0.11 70)",
    tintFrom: "oklch(96% 0.045 80 / 0.75)",
    tintTo: "oklch(96% 0.045 80 / 0.35)",
    label: "Admin & deadlines",
    titleWeight: 500,
  },
  iw: {
    accent: "oklch(51% 0.017 70)",
    tintFrom: "oklch(96% 0.008 85 / 0.6)",
    tintTo: "oklch(96% 0.008 85 / 0.25)",
    label: "Individual · bookable",
    titleWeight: 500,
  },
  lu: {
    accent: "transparent",
    tintFrom: "oklch(96% 0.008 85 / 0.35)",
    tintTo: "oklch(96% 0.008 85 / 0.15)",
    label: "Lunch",
    titleWeight: 400,
  },
};
