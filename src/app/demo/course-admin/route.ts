import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";

// Seeded course_administrator grant, scoped to the shared demo course
// (scripts/seed-demo.mjs). /dashboard resolves the actual landing
// (/dashboard/admin) itself via getCentreRoleContext + landingFor.
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
export async function GET(request: Request) {
  const day = parseDemoDay(new URL(request.url).searchParams.get("day"));
  return mintDemoMagicLink("demo-course-admin@celtaconnect.com", "/dashboard", day);
}
