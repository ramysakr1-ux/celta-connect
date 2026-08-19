import { NextResponse } from "next/server";
import { runAdmissionsAutoBookCron } from "@/lib/admissions-auto-booking";

// specs/for-claude-code-auto-booked-interview.md: the 15-minute hold only
// means something if the sweep that clears it runs often -- the whole
// point of the "clear" lane is a fast, trustworthy auto-send, not "some
// time today." So this is its own route, on its own tight schedule, rather
// than folded into the once-a-day admissions-waiting-list route (which
// stays on Vercel Cron; this one is fired by a Supabase pg_cron job every
// few minutes instead, since Vercel Cron on this project's plan can't go
// that often). Same CRON_SECRET-bearer pattern as every other cron route.
async function handleAutoBookCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const result = await runAdmissionsAutoBookCron();
  return NextResponse.json(result);
}

// Migration 0152's pg_cron job fires this via net.http_post, not http_get --
// GET alone was a live 405, meaning the 5-minute sweep has likely been
// silently failing since that migration shipped (found in passing, fixed
// here rather than editing the already-run migration to switch methods).
export const GET = handleAutoBookCron;
export const POST = handleAutoBookCron;
