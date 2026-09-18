import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";
import { demoDestination } from "@/lib/demo/demo-destination";

// Alan Whitfield, `centre_manager` -- the role that displays as "Centre
// observer": read-only across the whole centre. The seed has created this
// account since the Roles tab was built; there was simply never a way to
// log in as him, so the one role that can see everything and change nothing
// could not be demonstrated at all.
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const day = parseDemoDay(url.searchParams.get("day"));
  // ?to= sends this account to a named screen instead of its landing.
  const to = demoDestination(url.searchParams.get("to"), "/dashboard");
  return mintDemoMagicLink("demo-centre-observer@celtaconnect.com", to, day);
}
