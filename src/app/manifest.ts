import type { MetadataRoute } from "next";

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
    display: "standalone",
    background_color: "#faf7f2", // --color-background, oklch(97.8% 0.008 85)
    theme_color: "#3e2818", // --color-ink-warm, same tile color as the app icon
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
