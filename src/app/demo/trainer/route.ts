import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

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
export async function GET() {
  return mintDemoMagicLink("demo-trainer2@celtaconnect.com", "/trainer");
}
