import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";

// Same real demo trainee as /demo/trainee-precourse, landing straight on
// the day-one GTKY activity pick (specs/for-claude-code-pre-course-task-
// screens.md screen 1a0g) instead of the portfolio root.
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
export async function GET(request: Request) {
  const day = parseDemoDay(new URL(request.url).searchParams.get("day"));
  return mintDemoMagicLink("demo-amara@celtaconnect.com", (profileId) => `/portfolio/${profileId}/gtky`, day);
}
