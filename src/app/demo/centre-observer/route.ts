import { mintDemoMagicLink } from "@/lib/demo/mint-magic-link";

// Alan Whitfield, `centre_manager` -- the role that displays as "Centre
// observer": read-only across the whole centre. The seed has created this
// account since the Roles tab was built; there was simply never a way to
// log in as him, so the one role that can see everything and change nothing
// could not be demonstrated at all.
export async function GET() {
  return mintDemoMagicLink("demo-centre-observer@celtaconnect.com", "/dashboard");
}
