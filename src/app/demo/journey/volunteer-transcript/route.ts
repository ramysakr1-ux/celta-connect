import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

// Answers the question the journey page kept raising and never showed:
// where the volunteer's recording actually goes.
//
// It lands on volunteer_signup_profiles.transcript, which the trainer's
// own Volunteers page reads back per volunteer. /demo/trainer drops you on
// /trainer (Today) and leaves you to find it; this goes straight there, so
// the journey step is one click rather than a hunt.
export async function GET() {
  return mintDemoMagicLink("demo-trainer@celtaconnect.com", "/trainer/volunteers");
}
