import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Assignment briefs and marking guidance moved into the trainer hub on
  // 5 Sep 2026 (unpacking-the-kitchen-sink.md, Phase 2) -- old bookmarks
  // and emailed links keep working.
  async redirects() {
    return [
      { source: "/dashboard/trainer/assignment-briefs", destination: "/trainer/assignment-briefs", permanent: true },
      { source: "/dashboard/trainer/assignment-briefs/:id", destination: "/trainer/assignment-briefs/:id", permanent: true },
      { source: "/dashboard/trainer/marking-guidance", destination: "/trainer/marking-guidance", permanent: true },
    ];
  },
  /* Keep sharp out of the function bundles (21 Sep 2026).

     sharp is not a dependency of this app -- it arrives under next itself
     (next 16.2.12 -> sharp 0.34.5). Nothing in src/ imports it, nothing uses
     next/image, and on Vercel image optimisation runs in Vercel's own
     infrastructure rather than inside a function. Yet the tracer was packing
     its native libvips binary into 145 of 210 function bundles, where it came
     to 67% of everything Vercel stores for this project: 3.23 GB a deployment,
     which put the free tier's 10 GB Function Storage at 100%. Excluding it
     takes a deployment to 0.98 GB. The two ImageResponse routes (src/app/icon.tsx,
     src/app/apple-icon.tsx) render through Satori and still build.

     If a future feature really does need sharp at runtime, narrow the
     all-routes key below to the routes that don't, rather than deleting it. */
  outputFileTracingExcludes: {
    "**/*": ["node_modules/sharp/**", "node_modules/@img/**"],
  },

  experimental: {
    // Default is 1MB. Two audio-recording flows submit a file through a
    // Server Action's FormData (volunteer sign-up's continuous 2-3 minute
    // recording, the applicant pre-interview speaking task) -- both
    // routinely exceed the default, so this raises it for every Server
    // Action rather than just these two, since any future upload here
    // would hit the same wall.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
