import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

// Seeded centre_owner grant (scripts/seed-demo.mjs). /dashboard resolves
// the actual landing (/centre) itself via getCentreRoleContext + landingFor
// -- targeting it directly here would duplicate that role-to-route logic.
export async function GET() {
  return mintDemoMagicLink("demo-centre-admin@celtaconnect.com", "/dashboard");
}
