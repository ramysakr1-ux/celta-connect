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
