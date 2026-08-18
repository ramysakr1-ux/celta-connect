import { NextResponse } from "next/server";
import { runAdmissionsWaitingListCron } from "@/lib/admissions-cron";
import { runAdmissionsAutoBookCron } from "@/lib/admissions-auto-booking";
import { runMissedInstalmentsCron } from "@/lib/payments-cron";
import { runAnnouncementsFireCron } from "@/lib/announcements-cron";

// Vercel Cron hits this once a day (vercel.json). Same auth pattern as
// /api/cron/course-close-out-wipe -- Vercel signs cron requests with this
// secret, checking it is what keeps this off the open internet.
//
// Also runs the missed-instalments check, the scheduled-announcements
// fire, and the AI-triage auto-booking sweep here rather than as their own
// scheduled entries -- the Hobby plan this project is on caps cron jobs at
// 2/day, and course-close-out-wipe + this one already use both slots. See
// src/app/api/cron/payments-missed-instalments/route.ts for the missed-
// instalments check exposed as its own route for manual/testing use --
// it's real and callable, just not on the Vercel schedule. The auto-booking
// sweep's own 15-minute hold is consequently a floor, not a target -- see
// admissions-auto-booking.ts's comment.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const [admissions, autoBooking, payments, announcements] = await Promise.all([
    runAdmissionsWaitingListCron(),
    runAdmissionsAutoBookCron(),
    runMissedInstalmentsCron(),
    runAnnouncementsFireCron(),
  ]);
  return NextResponse.json({ admissions, autoBooking, payments, announcements });
}
