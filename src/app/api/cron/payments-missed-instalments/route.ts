import { NextResponse } from "next/server";
import { runMissedInstalmentsCron } from "@/lib/payments-cron";

// Same CRON_SECRET-bearer pattern as every other cron route in this app.
//
// Both methods, because migration 0163's pg_cron job fires this with
// net.http_post and this route exported GET alone -- so that job has
// answered 405 every run since it shipped. Exactly the fault the
// admissions-auto-book route's own comment describes; it was found there,
// fixed there and in late-push, and this third instance was missed.
//
// It went unnoticed because the work still happened: the daily
// admissions-waiting-list cron calls runMissedInstalmentsCron() too. What
// was lost is the frequency 0163 wanted, not the sweep itself. The function
// only ever flips rows that are still 'pending', so running from both is
// safe (walked 15 Sep 2026).
async function handleMissedInstalmentsCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const result = await runMissedInstalmentsCron();
  return NextResponse.json(result);
}

export const GET = handleMissedInstalmentsCron;
export const POST = handleMissedInstalmentsCron;
