import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

// Pairs with /demo/trainer (the main course tutor, Marcus Webb) -- this one
// logs in as the assistant course tutor instead (Jordan Blake,
// demo-trainer@celtaconnect.com), so the two can be compared side by side.
//
// Swapped 16 Sep 2026: this route had the accounts the other way round, so
// the link labelled "Trainer (ACT)" opened the MCT's view. Which tutor is
// which comes from course_tutors.tutor_role on the course the demo opens, not
// from the account names.
// Ramy, 2026-08-25: MCT and ACT get different layouts (garnet vs teal hub
// header/hover, per trainer/(hub)/layout.tsx's role-scoped --hub-* vars) and
// he wanted a separate link for each rather than one shared trainer entry.
export async function GET() {
  return mintDemoMagicLink("demo-trainer@celtaconnect.com", "/trainer");
}
