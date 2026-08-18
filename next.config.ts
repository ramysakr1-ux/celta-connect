import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
