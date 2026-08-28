import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

// Ramy, 28 Aug 2026: "it's not just about the email, it's about what they
// see when they land inside their page" -- same real demo trainee /demo/
// trainee uses (Amara Okafor, still 0/3 pre-course sections done, so this
// lands on the genuine "day one out" state, not a completed record), just
// straight into the Pre-course task tab instead of the portfolio root.
export async function GET() {
  return mintDemoMagicLink("demo-amara@celtaconnect.com", (profileId) => `/portfolio/${profileId}/pre-course-task`);
}
