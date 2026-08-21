import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

// Seeded course_administrator grant, scoped to the shared demo course
// (scripts/seed-demo.mjs). /dashboard resolves the actual landing
// (/dashboard/admin) itself via getCentreRoleContext + landingFor.
export async function GET() {
  return mintDemoMagicLink("demo-course-admin@celtaconnect.com", "/dashboard");
}
