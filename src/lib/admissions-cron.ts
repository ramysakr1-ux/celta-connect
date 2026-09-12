import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicantEmail, notThisTimeEmailHtml, offerLapsedEmailHtml } from "@/lib/admissions-email";
import { offerNextWaitingListPlace } from "@/lib/admissions-waiting-list";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { formatCalendarDate } from "@/lib/format-date";

// Two time-driven admissions checks, run once a day by
// src/app/api/cron/admissions-waiting-list/route.ts (same Vercel Cron
// pattern as the close-out grace-wipe). Scope note: the spec names four
// trigger sources for "a place has come free" -- withdrawal, deferral,
// unaccepted, or expired offer -- but only the place-freed 48h countdown
// (set via offerNextWaitingListPlace) is auto-advanced here. A *first*
// merit offer (Phase D/E's sendOffer, offer_accept_by only, no
// place_offer_expires_at) lapsing unresponded doesn't yet cascade to the
// waiting list -- there's no defined stage/email for "your offer expired"
// on its own, distinct from "not this time", so this was left for a
// follow-up rather than guessed at.
// The merit-offer case below was a deliberate gap until 12 Sep 2026 ("no
// defined stage/email for 'your offer expired'"). Closed on the strength of
// what the offer email itself promises -- "we will hold your place until X,
// after which it goes to the waiting list" (offerEmailHtml's footnote; the
// deposit-ask variant says the same of the deposit date) -- so an unanswered
// offer sitting at offer_sent for ever was the app breaking a promise it had
// put in writing. Ramy: "close it."
export async function runAdmissionsWaitingListCron(): Promise<{
  lapsedOffers: number;
  lapsedMeritOffers: number;
  autoAdvanced: number;
  notThisTime: number;
}> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  let lapsedOffers = 0;
  let autoAdvanced = 0;
  let lapsedMeritOffers = 0;

  // "On expiry the app moves to the next person on the list and drafts the
  // same email." -- place-freed offers (place_offer_expires_at set) that
  // passed their 48h window unaccepted.
  const { data: lapsed } = await admin
    .from("applicants")
    .select("id, full_name, email, center_id, intake_course_id")
    .eq("stage", "offer_sent")
    .not("place_offer_expires_at", "is", null)
    .lt("place_offer_expires_at", nowIso);

  for (const applicant of lapsed ?? []) {
    await admin
      .from("applicants")
      .update({ stage: "not_this_time", offer_token: null, place_offered_at: null, place_offer_expires_at: null })
      .eq("id", applicant.id);

    const [{ data: course }, { data: center }] = await Promise.all([
      admin.from("courses").select("name").eq("id", applicant.intake_course_id).maybeSingle(),
      admin.from("centers").select("name, admissions_email").eq("id", applicant.center_id).maybeSingle(),
    ]);
    await sendApplicantEmail({
      centerName: center?.name ?? "Your centre",
      centerAdmissionsEmail: center?.admissions_email ?? null,
      to: applicant.email,
      subject: "your CELTA application",
      centerId: applicant.center_id,
      applicantId: applicant.id,
      type: "not_this_time",
      html: notThisTimeEmailHtml({
        applicantName: applicant.full_name,
        courseName: course?.name ?? "the course",
        // Sent by the nightly job, so there is no person to name and no next
        // intake picked yet. The template drops those clauses rather than
        // printing a placeholder.
        positionWord: null,
        nextCourseName: null,
        nextCourseStart: null,
      }),
    });
    lapsedOffers++;

    const advance = await offerNextWaitingListPlace(admin, { centerId: applicant.center_id, intakeCourseId: applicant.intake_course_id });
    if (advance.offeredApplicantId) autoAdvanced++;
  }

  // "Sends automatically when the waiting-list deadline passes with no
  // place freed." -- applicants still on the list who were never offered a
  // place at all before their own hear-by date.
  // A merit offer -- sent by a decider with an accept-by DATE and no 48-hour
  // instant -- still unanswered the day after that date. Judged on the
  // centre's own calendar, not the server's: the cron runs at 04:00 UTC, which
  // is already tomorrow east of Greenwich and still yesterday west of it, and
  // an offer should not lapse an evening early in Los Angeles.
  const { data: meritCandidates } = await admin
    .from("applicants")
    .select("id, full_name, email, center_id, intake_course_id, offer_accept_by")
    .eq("stage", "offer_sent")
    .is("place_offer_expires_at", null)
    .not("offer_accept_by", "is", null)
    .lte("offer_accept_by", nowIso.slice(0, 10));
  const tzByCentre = new Map<string, string>();
  for (const applicant of meritCandidates ?? []) {
    if (!tzByCentre.has(applicant.center_id)) {
      const { data: c } = await admin.from("centers").select("time_zone").eq("id", applicant.center_id).maybeSingle();
      tzByCentre.set(applicant.center_id, c?.time_zone || DEFAULT_TIMEZONE);
    }
    const timeZone = tzByCentre.get(applicant.center_id)!;
    // "Accept by the 14th" means the 14th is still theirs.
    if (!applicant.offer_accept_by || applicant.offer_accept_by >= toLocalIso(new Date(), timeZone)) continue;

    // The link dies with the offer: /offer/[token] then reads "expired or
    // already used", which is exactly true. Re-checking the stage in the
    // write means an acceptance that landed since the select above wins.
    const { data: lapsedRow } = await admin
      .from("applicants")
      .update({ stage: "not_this_time", offer_token: null })
      .eq("id", applicant.id)
      .eq("stage", "offer_sent")
      .select("id")
      .maybeSingle();
    if (!lapsedRow) continue;

    // The next person first, so the email can say truthfully where the
    // place went.
    const advance = await offerNextWaitingListPlace(admin, { centerId: applicant.center_id, intakeCourseId: applicant.intake_course_id });
    if (advance.offeredApplicantId) autoAdvanced++;

    const [{ data: course }, { data: center }] = await Promise.all([
      admin.from("courses").select("name").eq("id", applicant.intake_course_id).maybeSingle(),
      admin.from("centers").select("name, admissions_email").eq("id", applicant.center_id).maybeSingle(),
    ]);
    await sendApplicantEmail({
      centerName: center?.name ?? "Your centre",
      centerAdmissionsEmail: center?.admissions_email ?? null,
      to: applicant.email,
      subject: "your offer has lapsed",
      centerId: applicant.center_id,
      applicantId: applicant.id,
      type: "not_this_time",
      html: offerLapsedEmailHtml({
        applicantName: applicant.full_name,
        courseName: course?.name ?? "the course",
        heldUntil: formatCalendarDate(applicant.offer_accept_by, { weekday: "long", month: "long", year: "numeric" }),
        nextApplicantOffered: Boolean(advance.offeredApplicantId),
      }),
    });
    lapsedMeritOffers++;
  }

  const today = nowIso.slice(0, 10);
  const { data: expired } = await admin
    .from("applicants")
    .select("id, full_name, email, center_id, intake_course_id")
    .eq("stage", "waiting_list")
    .is("place_offered_at", null)
    .not("waiting_list_hear_by", "is", null)
    .lt("waiting_list_hear_by", today);

  let notThisTime = 0;
  for (const applicant of expired ?? []) {
    await admin.from("applicants").update({ stage: "not_this_time" }).eq("id", applicant.id);

    const [{ data: course }, { data: center }] = await Promise.all([
      admin.from("courses").select("name").eq("id", applicant.intake_course_id).maybeSingle(),
      admin.from("centers").select("name, admissions_email").eq("id", applicant.center_id).maybeSingle(),
    ]);
    await sendApplicantEmail({
      centerName: center?.name ?? "Your centre",
      centerAdmissionsEmail: center?.admissions_email ?? null,
      to: applicant.email,
      subject: "your CELTA application",
      centerId: applicant.center_id,
      applicantId: applicant.id,
      type: "not_this_time",
      html: notThisTimeEmailHtml({
        applicantName: applicant.full_name,
        courseName: course?.name ?? "the course",
        // Sent by the nightly job, so there is no person to name and no next
        // intake picked yet. The template drops those clauses rather than
        // printing a placeholder.
        positionWord: null,
        nextCourseName: null,
        nextCourseStart: null,
      }),
    });
    notThisTime++;
  }

  return { lapsedOffers, lapsedMeritOffers, autoAdvanced, notThisTime };
}
