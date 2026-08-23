import { NextResponse } from "next/server";
import { runVolunteerSessionEmailReminderCron } from "@/lib/volunteer-session-email-reminder-cron";

// Fired once daily by a Supabase pg_cron job (migration 0201) via
// net.http_post, same pattern as /api/cron/volunteer-session-reminder
// (the 30-minutes-before push).
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const result = await runVolunteerSessionEmailReminderCron();
  return NextResponse.json(result);
}
