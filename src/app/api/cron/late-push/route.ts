import { NextResponse } from "next/server";
import { runLatePushCron } from "@/lib/late-push-cron";

// migration 0178 -- fired daily by a Supabase pg_cron job via net.http_post
// (not http_get), so both methods are exported from the start -- the
// admissions-auto-book route shipped GET-only and silently 405'd against
// its own pg_cron job for a while before that was caught.
async function handleLatePushCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const result = await runLatePushCron();
  return NextResponse.json(result);
}

export const GET = handleLatePushCron;
export const POST = handleLatePushCron;
