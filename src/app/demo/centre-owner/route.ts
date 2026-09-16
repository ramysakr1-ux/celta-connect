import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";

// Lands on the Centre Owner screen itself, not on Centre Management.
//
// /demo/centre-admin signs in as the same person -- Diane Okonkwo holds
// centre_owner -- but drops them on /dashboard, which resolves to /centre.
// So the entry point labelled "Centre owner" opened Centre Management, and
// the owner screen (the role builder, the custodial powers, the branch
// visibility) was only reachable by knowing to click through to it. Ramy,
// 30 Aug 2026: "centre owner link lands in centre management, not centre
// owner."
//
// Same account, different destination -- the owner screen is a place, not a
// separate login.
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
export async function GET(request: Request) {
  const day = parseDemoDay(new URL(request.url).searchParams.get("day"));
  return mintDemoMagicLink("demo-centre-admin@celtaconnect.com", "/centre/owner", day);
}
