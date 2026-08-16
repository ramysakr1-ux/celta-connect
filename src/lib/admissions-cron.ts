import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicantEmail, notThisTimeEmailHtml } from "@/lib/admissions-email";
import { offerNextWaitingListPlace } from "@/lib/admissions-waiting-list";

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
export async function runAdmissionsWaitingListCron(): Promise<{ lapsedOffers: number; autoAdvanced: number; notThisTime: number }> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  let lapsedOffers = 0;
  let autoAdvanced = 0;

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
      subject: `${course?.name ?? "Your application"} -- update on your application`,
      centerId: applicant.center_id,
      applicantId: applicant.id,
      type: "not_this_time",
      html: notThisTimeEmailHtml({ applicantName: applicant.full_name, courseName: course?.name ?? "the course" }),
    });
    lapsedOffers++;

    const advance = await offerNextWaitingListPlace(admin, { centerId: applicant.center_id, intakeCourseId: applicant.intake_course_id });
    if (advance.offeredApplicantId) autoAdvanced++;
  }

  // "Sends automatically when the waiting-list deadline passes with no
  // place freed." -- applicants still on the list who were never offered a
  // place at all before their own hear-by date.
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
      subject: `${course?.name ?? "Your application"} -- update on your application`,
      centerId: applicant.center_id,
      applicantId: applicant.id,
      type: "not_this_time",
      html: notThisTimeEmailHtml({ applicantName: applicant.full_name, courseName: course?.name ?? "the course" }),
    });
    notThisTime++;
  }

  return { lapsedOffers, autoAdvanced, notThisTime };
}
