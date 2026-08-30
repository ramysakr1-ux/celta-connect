import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

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
export async function GET() {
  return mintDemoMagicLink("demo-centre-admin@celtaconnect.com", "/centre/owner");
}
