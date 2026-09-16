import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";

// Ramy, 28 Aug 2026: "it's not just about the email, it's about what they
// see when they land inside their page" -- same real demo trainee /demo/
// trainee uses (Amara Okafor, still 0/3 pre-course sections done, so this
// lands on the genuine "day one out" state, not a completed record), just
// straight into the Pre-course task tab instead of the portfolio root.
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
export async function GET(request: Request) {
  const day = parseDemoDay(new URL(request.url).searchParams.get("day"));
  return mintDemoMagicLink("demo-amara@celtaconnect.com", (profileId) => `/portfolio/${profileId}/pre-course-task`, day);
}
