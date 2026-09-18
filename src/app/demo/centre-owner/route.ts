import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";
import { safeRedirectPath } from "@/lib/safe-redirect";

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
//
// `?to=` lets one card send this account somewhere other than its own
// landing. The Course Story's "Creates the course" card names the New
// course wizard in its own subtitle and used to link here with no `to`,
// which put the visitor on the owner's dashboard -- a screen with no
// course-creation action on it at all -- instead of the wizard itself.
// Diane holds course.create as a centre owner, so /centre/courses/new is
// hers to open. Ramy, 18 Sep 2026: "I click Create the course... it takes
// me to the centre owner landing page." Restricted to same-origin paths by
// safeRedirectPath, same guard the sign-in page uses for its own `next`.
//
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const day = parseDemoDay(url.searchParams.get("day"));
  const to = safeRedirectPath(url.searchParams.get("to"), "/centre/owner");
  return mintDemoMagicLink("demo-centre-admin@celtaconnect.com", to, day);
}
