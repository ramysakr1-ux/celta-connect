import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";
import { demoDestination } from "@/lib/demo/demo-destination";
import { demoWouldReplaceRealSession } from "@/lib/demo/demo-session-guard";

// Amara Okafor -- the richest of the three seeded trainees (4 TPs graded,
// two approved assignments, a Pass B on CELTA5), so the trainee demo lands
// somewhere worth exploring rather than an empty portfolio. This is a real
// trainee auth account, same as any candidate signing in from their own
// join link -- there was never a schema gap here, only a missing route.
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
  const to = await demoDestination(url.searchParams.get("to"), (profileId) => `/portfolio/${profileId}`);
  return mintDemoMagicLink("demo-amara@celtaconnect.com", to, day);
}
