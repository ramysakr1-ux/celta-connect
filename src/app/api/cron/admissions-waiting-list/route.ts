import { NextResponse } from "next/server";
import { runAdmissionsWaitingListCron } from "@/lib/admissions-cron";
import { runMissedInstalmentsCron } from "@/lib/payments-cron";
import { runAnnouncementsFireCron } from "@/lib/announcements-cron";
import { runStartsMondayCron } from "@/lib/starts-monday-cron";
import { runVolunteerClassStartingCron } from "@/lib/volunteer-class-starting-cron";

// Vercel Cron hits this once a day (vercel.json). Same auth pattern as
// /api/cron/course-close-out-wipe -- Vercel signs cron requests with this
// secret, checking it is what keeps this off the open internet.
//
// Also runs the missed-instalments check and the scheduled-announcements
// fire here rather than as their own scheduled entries -- the Hobby plan
// this project is on caps cron jobs at 2/day, and course-close-out-wipe +
// this one already use both slots. See
// src/app/api/cron/payments-missed-instalments/route.ts for the missed-
// instalments check exposed as its own route for manual/testing use --
// it's real and callable, just not on the Vercel schedule.
//
// The AI-triage auto-booking sweep (/api/cron/admissions-auto-book) does
// NOT run from here -- specs/for-claude-code-auto-booked-interview.md: a
// once-a-day sweep made the 15-minute hold meaningless, since the whole
// point of the "clear" lane is a fast, trustworthy auto-send. It runs from
// a Supabase pg_cron job every few minutes instead (migration 0152),
// independent of Vercel's cron limits.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const [admissions, payments, announcements, startsMonday, volunteerClassStarting] = await Promise.all([
    runAdmissionsWaitingListCron(),
    runMissedInstalmentsCron(),
    runAnnouncementsFireCron(),
    runStartsMondayCron(),
    runVolunteerClassStartingCron(),
  ]);
  return NextResponse.json({ admissions, payments, announcements, startsMonday, volunteerClassStarting });
}
