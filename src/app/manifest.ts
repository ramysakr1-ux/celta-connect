import type { MetadataRoute } from "next";
import { SPLASH_BACKGROUND } from "@/lib/role-shortcuts";

// specs/build-spec.md §7: "Offer 'Add to Home Screen' for trainees only
// (daily use for five weeks)." Next's manifest.ts file convention serves
// this at /manifest.webmanifest and auto-injects the <link rel="manifest">
// tag -- no manual wiring needed in layout.tsx. The actual install-prompt UI
// (install-prompt.tsx) is what gates this to trainees only; the manifest
// itself has no concept of "who's asking" and is fine to serve to anyone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Connect",
    short_name: "Connect",
    description: "CELTA course administration, built for centers.",
    start_url: "/",
    display: "minimal-ui",
    // --color-background, oklch(92.5% 0.012 85), through Oklab. Was "#faf7f2"
    // with a comment naming 97.8% -- the ground the app stopped using on 16
    // Aug 2026, so every splash screen opened a shade lighter than the app.
    background_color: SPLASH_BACKGROUND,
    theme_color: "#3e2818", // --color-ink-warm, same tile color as the app icon
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
