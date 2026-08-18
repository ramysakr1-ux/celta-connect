import { NextResponse } from "next/server";
import { runVolunteerSessionReminderCron } from "@/lib/volunteer-session-reminder-cron";

// Fired every 5 minutes by a Supabase pg_cron job (migration 0158) via
// net.http_post, independent of Vercel Cron's plan limits -- same pattern
// as /api/cron/admissions-auto-book. POST, matching what net.http_post
// actually sends (that route only exports GET, which a POST call would
// 405 against -- worth checking separately; this one is built correctly
// from the start).
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const result = await runVolunteerSessionReminderCron();
  return NextResponse.json(result);
}
