import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";
import { demoDestination } from "@/lib/demo/demo-destination";

// Moved from /demo now that /demo itself is the five-entry-point landing
// page (connect-multi-role-demo-spec-2026-08-22.md).
//
// The MCT entry, because /demo calls it "Trainer (MCT)". It signs in as
// Jordan Blake (demo-trainer@), who is the MAIN course tutor on the course
// the demo actually opens -- "CELTA Demo Course", started 31 Aug 2026 --
// per course_tutors.tutor_role, the only place the role is never stale.
// Ramy, 16 Sep 2026: "MCT ACT lead to different pages."
//
// SWAPPED BACK 18 Sep 2026. A change on the 16th moved this link to
// demo-trainer2@ (Marcus Webb) on the belief that Marcus was the main tutor
// and Jordan only led the Spring course. The database says the opposite:
// Jordan is main_course_tutor on BOTH the running demo course and the
// Spring one, and Marcus is assistant_course_tutor on the running course --
// which seed-demo.mjs agrees with, calling him "the ACT (Marcus Webb)".
// So the MCT link had been opening the ACT's hub and vice versa, and the
// per-role install manifest followed it. Read course_tutors before trusting
// a name.
//
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const day = parseDemoDay(url.searchParams.get("day"));
  // ?to= sends this account to a named screen instead of its landing.
  const to = demoDestination(url.searchParams.get("to"), "/trainer");
  return mintDemoMagicLink("demo-trainer@celtaconnect.com", to, day);
}
