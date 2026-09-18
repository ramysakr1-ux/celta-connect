import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";
import { demoDestination } from "@/lib/demo/demo-destination";
import { demoWouldReplaceRealSession } from "@/lib/demo/demo-session-guard";

// Seeded course_administrator grant, scoped to the shared demo course
// (scripts/seed-demo.mjs). /dashboard resolves the actual landing
// (/dashboard/admin) itself via getCentreRoleContext + landingFor.
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
  // ?to= sends this account to a named screen instead of its landing.
  const to = await demoDestination(url.searchParams.get("to"), "/dashboard");
  return mintDemoMagicLink("demo-course-admin@celtaconnect.com", to, day);
}
