import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

// Amara Okafor -- the richest of the three seeded trainees (4 TPs graded,
// two approved assignments, a Pass B on CELTA5), so the trainee demo lands
// somewhere worth exploring rather than an empty portfolio. This is a real
// trainee auth account, same as any candidate signing in from their own
// join link -- there was never a schema gap here, only a missing route.
export async function GET() {
  return mintDemoMagicLink("demo-amara@celtaconnect.com", (profileId) => `/portfolio/${profileId}`);
}
