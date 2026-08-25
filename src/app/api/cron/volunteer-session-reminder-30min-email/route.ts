import { NextResponse } from "next/server";
import { runVolunteer30MinEmailReminderCron } from "@/lib/volunteer-30min-email-reminder-cron";

// Fired every 5 minutes by a Supabase pg_cron job (migration 0214) via
// net.http_post, same pattern as /api/cron/volunteer-session-reminder
// (the push) and /api/cron/volunteer-session-reminder-email (day before).
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const result = await runVolunteer30MinEmailReminderCron();
  return NextResponse.json(result);
}
