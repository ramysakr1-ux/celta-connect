import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";

// Moved from /demo now that /demo itself is the five-entry-point landing
// page (connect-multi-role-demo-spec-2026-08-22.md).
//
// The MCT entry, because /demo calls it "Trainer (MCT)". It signs in as
// Marcus Webb (demo-trainer2@), who is the MAIN course tutor on the demo
// course -- course_tutors.tutor_role, which is the only place the role is
// never stale. Ramy, 16 Sep 2026: "MCT ACT lead to different pages."
//
// The two were the wrong way round: this link used demo-trainer@ (Jordan
// Blake), who is the ASSISTANT course tutor on that course, so the MCT link
// opened the ACT view and vice versa. Jordan is an MCT, but on the Spring
// course, which is not the one the demo opens.
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
export async function GET(request: Request) {
  const day = parseDemoDay(new URL(request.url).searchParams.get("day"));
  return mintDemoMagicLink("demo-trainer2@celtaconnect.com", "/trainer", day);
}
