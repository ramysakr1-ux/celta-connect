import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";
import { demoDestination } from "@/lib/demo/demo-destination";
import { demoWouldReplaceRealSession } from "@/lib/demo/demo-session-guard";

// Ramy, 28 Aug 2026: "it's not just about the email, it's about what they
// see when they land inside their page" -- same real demo trainee /demo/
// trainee uses (Amara Okafor, still 0/3 pre-course sections done, so this
// lands on the genuine "day one out" state, not a completed record), just
// straight into the Pre-course task tab instead of the portfolio root.
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
export async function GET(request: Request) {
  // One screen first if a real session is about to be replaced
  // (demo-session-guard.ts).
  const swap = await demoWouldReplaceRealSession(request);
  if (swap) return swap;
  const url = new URL(request.url);
  const day = parseDemoDay(url.searchParams.get("day"));
  // ?to= may carry {me} for this candidate's own id, so a story card
  // can name "/portfolio/{me}/tp/3" without knowing who the demo seeded.
  const to = await demoDestination(url.searchParams.get("to"), (profileId) => `/portfolio/${profileId}/pre-course-task`);
  return mintDemoMagicLink("demo-amara@celtaconnect.com", to, day);
}
