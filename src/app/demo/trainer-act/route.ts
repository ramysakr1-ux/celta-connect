import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

// Pairs with /demo/trainer (the main course tutor, Jordan Blake) -- this one
// logs in as the seeded assistant course tutor instead (Marcus Webb,
// demo-trainer2@celtaconnect.com), so the two can be compared side by side.
// Ramy, 2026-08-25: MCT and ACT get different layouts (garnet vs teal hub
// header/hover, per trainer/(hub)/layout.tsx's role-scoped --hub-* vars) and
// he wanted a separate link for each rather than one shared trainer entry.
export async function GET() {
  return mintDemoMagicLink("demo-trainer2@celtaconnect.com", "/trainer");
}
