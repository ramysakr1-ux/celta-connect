import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";
import { demoDestination } from "@/lib/demo/demo-destination";

// Pairs with /demo/trainer (the main course tutor, Jordan Blake) -- this one
// signs in as the assistant course tutor instead, Marcus Webb
// (demo-trainer2@celtaconnect.com), so the two can be compared side by side.
//
// SWAPPED BACK 18 Sep 2026, along with /demo/trainer: the 16 Sep change had
// the accounts the wrong way round, so this link opened the MCT's view.
// Which tutor is which comes from course_tutors.tutor_role on the course the
// demo opens -- Marcus is assistant_course_tutor there, and seed-demo.mjs
// builds him as the ACT -- never from the account names or profiles.tutor_role,
// which is set once at signup and never re-synced.
//
// Ramy, 2026-08-25: MCT and ACT get different layouts (garnet vs teal hub
// header/hover, per trainer/(hub)/layout.tsx's role-scoped --hub-* vars) and
// he wanted a separate link for each rather than one shared trainer entry.
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const day = parseDemoDay(url.searchParams.get("day"));
  // ?to= sends this account to a named screen instead of its landing.
  const to = demoDestination(url.searchParams.get("to"), "/trainer");
  return mintDemoMagicLink("demo-trainer2@celtaconnect.com", to, day);
}
