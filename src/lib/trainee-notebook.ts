// Shared by the notebook's server actions, the client panel and the layout.
// Lives outside the "use server" file because only async functions survive
// as exports there -- a constant becomes a non-callable proxy in the client.
export const NOTEBOOK_PAPERS = ["blue", "pink", "cream", "mint", "lavender", "white"] as const;
export type NotebookPaper = (typeof NOTEBOOK_PAPERS)[number];

export interface TraineeNote {
  id: string;
  anchor_path: string;
  anchor_label: string;
  body: string;
  created_at: string;
  updated_at: string;
  /** Migration 0294: a voice note keeps its recording; body is the transcript. */
  audio_path?: string | null;
  audio_duration_seconds?: number | null;
  /** Signed for this page load -- never stored. */
  audio_url?: string | null;
}

/** The private bucket voice notes live in (migration 0294). */
export const NOTEBOOK_AUDIO_BUCKET = "trainee-notebook-audio";

// The trainee's page palette -- paper, not a theme. Five palettes that move
// the neutral ladder (page ground -> frame -> card -> inset -> muted tint)
// onto a faint hue and leave every semantic colour where it is. "linen" is
// the app's own warm neutral, i.e. no override.
export const PAGE_PALETTES = ["linen", "sky", "sage", "rose", "lavender"] as const;
export type PagePalette = (typeof PAGE_PALETTES)[number];

export const PAGE_PALETTE_LABEL: Record<PagePalette, string> = {
  linen: "Linen",
  sky: "Sky",
  sage: "Sage",
  rose: "Rose",
  lavender: "Lavender",
};

/** The five neutral tokens, hue-shifted at the same lightness as the linen ladder. */
export function pagePaletteVars(palette: PagePalette): Record<string, string> {
  const hue = { linen: null, sky: 235, sage: 160, rose: 350, lavender: 300 }[palette];
  if (hue === null) return {};
  return {
    "--color-background": `oklch(92.5% 0.018 ${hue})`,
    "--color-frame": `oklch(97.8% 0.009 ${hue})`,
    "--color-card": `oklch(96.4% 0.016 ${hue})`,
    "--color-card-inset": `oklch(93% 0.024 ${hue})`,
    "--color-surface-muted": `oklch(94.8% 0.013 ${hue})`,
    "--color-border": `oklch(88% 0.02 ${hue})`,
  };
}

/** The swatch colour that stands for a palette in the picker. */
export function pagePaletteSwatch(palette: PagePalette): string {
  return palette === "linen" ? "oklch(93% 0.024 80)" : pagePaletteVars(palette)["--color-card-inset"];
}
