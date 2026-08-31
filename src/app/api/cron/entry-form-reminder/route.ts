import { NextResponse } from "next/server";
import { runEntryFormReminderCron } from "@/lib/entry-form-reminder-cron";

// Fired daily at 06:00 UTC by a Supabase pg_cron job (migration 0264) via
// net.http_post. POST only, matching what net.http_post actually sends --
// /api/cron/admissions-auto-book once exported GET alone and every call 405'd
// silently for weeks, so the shape matters.
//
// The URL in 0264 is www.celtaconnect.com, not the apex. The apex 308-redirects
// and an Authorization header does not survive a redirect to a different host:
// that is what had every cron in this project returning 401 until 31 Aug 2026.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const result = await runEntryFormReminderCron();
  return NextResponse.json(result);
}
