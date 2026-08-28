import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

// Same real demo trainee as /demo/trainee-precourse, landing straight on
// the day-one GTKY activity pick (specs/for-claude-code-pre-course-task-
// screens.md screen 1a0g) instead of the portfolio root.
export async function GET() {
  return mintDemoMagicLink("demo-amara@celtaconnect.com", (profileId) => `/portfolio/${profileId}/gtky`);
}
