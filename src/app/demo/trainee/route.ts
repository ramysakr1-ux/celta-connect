import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";

// Amara Okafor -- the richest of the three seeded trainees (4 TPs graded,
// two approved assignments, a Pass B on CELTA5), so the trainee demo lands
// somewhere worth exploring rather than an empty portfolio. This is a real
// trainee auth account, same as any candidate signing in from their own
// join link -- there was never a schema gap here, only a missing route.
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
export async function GET(request: Request) {
  const day = parseDemoDay(new URL(request.url).searchParams.get("day"));
  return mintDemoMagicLink("demo-amara@celtaconnect.com", (profileId) => `/portfolio/${profileId}`, day);
}
