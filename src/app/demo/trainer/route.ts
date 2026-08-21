import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

// Moved from /demo now that /demo itself is the five-entry-point landing
// page (connect-multi-role-demo-spec-2026-08-22.md). Same account, same
// mechanism as before.
export async function GET() {
  return mintDemoMagicLink("demo-trainer@celtaconnect.com", "/trainer");
}
