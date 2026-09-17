import type { MetadataRoute } from "next";
import { SPLASH_BACKGROUND } from "@/lib/role-shortcuts";

// Apex redirects to www (it is what stripped the cron Authorization header
// on 1 Sep 2026), so www is canonical here.
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.celtaconnect.com").replace(/\/$/, "");

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
    // standalone, with minimal-ui asked for on top. Chrome on macOS will not
    // install a plain minimal-ui manifest at all -- no address-bar icon, no
    // install event -- which is what stopped every "add to home screen" on
    // Ramy's Mac on 17 Sep 2026 (found by bisecting with three test pages).
    // display_override keeps the address bar he wants in the installed
    // window, on browsers that honour it.
    display: "standalone",
    display_override: ["minimal-ui"],
    // --color-background, oklch(92.5% 0.012 85), through Oklab. Was "#faf7f2"
    // with a comment naming 97.8% -- the ground the app stopped using on 16
    // Aug 2026, so every splash screen opened a shade lighter than the app.
    background_color: SPLASH_BACKGROUND,
    theme_color: "#3e2818", // --color-ink-warm, same tile color as the app icon
    // The manifest names itself, so a page can ask Chrome whether this app is
    // already installed (navigator.getInstalledRelatedApps in
    // install-prompt.tsx). No request object reaches this file convention, so
    // the host comes from the environment; it must be the canonical one the
    // app is served from, or the match silently fails and the pill simply
    // keeps showing, as it did before.
    related_applications: [{ platform: "webapp", url: `${SITE_ORIGIN}/manifest.webmanifest` }],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
