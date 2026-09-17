import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";
import { parseStoryStage } from "@/lib/admissions-story-stage";

// Signs in as Priya Raman, who actually holds `centre_administrator` --
// the role that displays as "Centre manager".
//
// This link used to sign in as demo-centre-admin@celtaconnect.com, the same
// account /demo/centre-owner uses, whose only centre role is centre_owner.
// So "log in as centre management" logged you in as the owner, and every
// owner-only thing on screen looked like something a centre manager could
// see. Ramy, 1 Sep 2026: "not to mention that I logged in as centre
// management. So what's going on there?"
//
// No destination given: resolveLandingPath sends each role to its own home
// now, which is the thing being demonstrated.
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
// `?stage=<stage>` opens the Admissions room on the seeded applicant at that
// stage instead of the landing (for-claude-code-demo-clock.md §3) -- the
// Course Story's pre-course cards use it. Anything that is not one of the
// five story stages is ignored and the link lands where it always did.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const day = parseDemoDay(url.searchParams.get("day"));
  const stage = parseStoryStage(url.searchParams.get("stage"));
  const next = stage ? `/dashboard/admissions?stage=${stage}` : "/dashboard";
  return mintDemoMagicLink("demo-centre-manager@celtaconnect.com", next, day);
}
