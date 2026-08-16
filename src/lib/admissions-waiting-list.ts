import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendApplicantEmail, placeFreedEmailHtml } from "@/lib/admissions-email";
import type { Database } from "@/lib/supabase/types";

function formatDeadline(d: Date): string {
  // "A named day and hour, not a number of days." No per-centre timezone
  // exists in the schema, so this is UTC -- said explicitly rather than
  // implying a local time that isn't actually known.
  return (
    d.toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
}

// "Triggered by a withdrawal, deferral, unaccepted or expired offer. The
// app names who is next and drafts it... the button carries the
// countdown." Reuses the exact same offer_token/accept-page mechanism as a
// fresh offer -- accepting this literally is accepting the offer -- just
// with a 48-hour timestamp deadline instead of a staff-picked date.
//
// Shared by the staff-triggered action (session client, one center) and
// the cron auto-advance (admin client, all centers) -- takes whichever
// typed client the caller already has.
export async function offerNextWaitingListPlace(
  supabase: SupabaseClient<Database>,
  input: { centerId: string; intakeCourseId: string }
): Promise<{ offeredApplicantId: string; offeredApplicantName: string } | { offeredApplicantId: null; reason: string }> {
  const { data: next } = await supabase
    .from("applicants")
    .select("id, full_name, email")
    .eq("center_id", input.centerId)
    .eq("intake_course_id", input.intakeCourseId)
    .eq("stage", "waiting_list")
    .eq("waiting_list_opt_out", false)
    .order("waiting_list_position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!next) return { offeredApplicantId: null, reason: "No one is on the waiting list for this intake." };

  const offerToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  // Re-checking stage='waiting_list' here (not just filtering by id) closes
  // a TOCTOU gap between the select above and this write: if the applicant
  // was rejected, opted out, or already offered a place by a concurrent
  // action in between, this update matches zero rows instead of silently
  // overwriting that change and sending a real offer email regardless.
  const { data: updated, error } = await supabase
    .from("applicants")
    .update({
      stage: "offer_sent",
      offer_sent_at: new Date().toISOString(),
      offer_accept_by: expiresAt.toISOString().slice(0, 10),
      offer_token: offerToken,
      place_offered_at: new Date().toISOString(),
      place_offer_expires_at: expiresAt.toISOString(),
    })
    .eq("id", next.id)
    .eq("stage", "waiting_list")
    .select("id")
    .maybeSingle();
  if (error) return { offeredApplicantId: null, reason: "Could not record the offer." };
  if (!updated) return { offeredApplicantId: null, reason: "That applicant's status just changed -- try again." };

  const siteUrl = process.env.SITE_URL;
  if (siteUrl) {
    const [{ data: course }, { data: center }] = await Promise.all([
      supabase.from("courses").select("name, start_date, end_date").eq("id", input.intakeCourseId).maybeSingle(),
      supabase.from("centers").select("name, admissions_email").eq("id", input.centerId).maybeSingle(),
    ]);
    await sendApplicantEmail({
      centerName: center?.name ?? "Your centre",
      centerAdmissionsEmail: center?.admissions_email ?? null,
      to: next.email,
      subject: `a place has opened on ${course?.name ?? "the course"}`,
      centerId: input.centerId,
      applicantId: next.id,
      type: "place_freed",
      // No sentBy -- a cron sent this, and naming a person who didn't would be
      // a small lie in an audit trail.
      html: placeFreedEmailHtml({
        applicantName: next.full_name,
        courseName: course?.name ?? "the course",
        courseDates:
          course?.start_date && course?.end_date
            ? `${new Date(`${course.start_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} to ${new Date(`${course.end_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`
            : "the dates confirmed with you",
        // "it starts in eleven days" -- the design says it plainly, because
        // short notice is the whole reason this email reads as it does.
        startsInPhrase: course?.start_date
          ? (() => {
              const days = Math.ceil(
                (new Date(`${course.start_date}T00:00:00`).getTime() - Date.now()) / 86400000
              );
              return days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : "very soon";
            })()
          : "",
        feeLine: "The fee is as set for this course;",
        respondBy: formatDeadline(expiresAt),
        offerUrl: `${siteUrl}/offer/${offerToken}`,
        hoursLeftLabel: "Accept your place",
        nextCourseName: null,
      }),
    });
  }

  await supabase.from("admissions_notifications").insert({
    center_id: input.centerId,
    applicant_id: next.id,
    type: "place_offered",
    message: `A place has been offered to ${next.full_name} -- expires ${formatDeadline(expiresAt)}.`,
  });

  return { offeredApplicantId: next.id, offeredApplicantName: next.full_name };
}
