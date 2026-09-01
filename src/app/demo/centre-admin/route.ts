import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

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
export async function GET() {
  return mintDemoMagicLink("demo-centre-manager@celtaconnect.com", "/dashboard");
}
