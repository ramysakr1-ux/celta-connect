import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";
import { demoDestination } from "@/lib/demo/demo-destination";
import { demoWouldReplaceRealSession } from "@/lib/demo/demo-session-guard";

// Same real demo trainee as /demo/trainee-precourse, landing straight on
// the day-one GTKY activity pick (specs/for-claude-code-pre-course-task-
// screens.md screen 1a0g) instead of the portfolio root.
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
  const to = demoDestination(url.searchParams.get("to"), (profileId) => `/portfolio/${profileId}/gtky`);
  return mintDemoMagicLink("demo-amara@celtaconnect.com", to, day);
}
