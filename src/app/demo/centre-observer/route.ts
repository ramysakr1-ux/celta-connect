import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";
import { parseDemoDay } from "@/lib/demo-clock";

// Alan Whitfield, `centre_manager` -- the role that displays as "Centre
// observer": read-only across the whole centre. The seed has created this
// account since the Roles tab was built; there was simply never a way to
// log in as him, so the one role that can see everything and change nothing
// could not be demonstrated at all.
// `?day=N` pins the demo clock before the magic-link hop
// (for-claude-code-demo-clock.md). No day means the real clock, and it clears
// any day a previous link left behind.
export async function GET(request: Request) {
  const day = parseDemoDay(new URL(request.url).searchParams.get("day"));
  return mintDemoMagicLink("demo-centre-observer@celtaconnect.com", "/dashboard", day);
}
