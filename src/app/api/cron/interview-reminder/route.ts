import { NextResponse } from "next/server";
import { runInterviewReminderCron } from "@/lib/interview-reminder-cron";

// Fired every 5 minutes by a Supabase pg_cron job (migration 0265) via
// net.http_post, same pattern as /api/cron/volunteer-session-reminder-30min-email.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const result = await runInterviewReminderCron();
  return NextResponse.json(result);
}
