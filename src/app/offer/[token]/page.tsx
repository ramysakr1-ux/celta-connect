import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/wordmark";
import { OfferAcceptForm } from "@/app/offer/[token]/offer-accept-form";
import { formatCalendarDate, formatDateTime } from "@/lib/format-date";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

const longDate = (iso: string) => formatCalendarDate(iso, { month: "long", year: "numeric" });

// "Accepting is what creates the account" -- but only once the centre has
// actually released the workspace (releaseWorkspace, admissions/actions.ts,
// normally triggered by the deposit clearing). Both the offer email
// (acceptancePlaceEmailHtml, asks for the deposit) and the later workspace
// email (welcomeEmailHtml) point at this SAME /offer/[token] link -- before
// release, this used to show the account-creation form regardless, which
// meant clicking the very first email's link created a full account with
// no deposit ever checked. Gated on workspace_released_at now: the same
// token becomes the real account-creation link only once release has
// happened, exactly matching what the two emails actually promise.
//
// The public offer-acceptance page -- looks up by offer_token
// (public.applicants.offer_token, minted when a decider records an offer,
// src/app/dashboard/admissions/actions.ts sendOffer). Same unified
// sheet-entry entry-moment look as /join/[token].
export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: applicant } = await admin.from("applicants").select("*").eq("offer_token", token).maybeSingle();

  const invalid =
    !applicant ||
    applicant.stage !== "offer_sent" ||
    (applicant.offer_accept_by && applicant.offer_accept_by < new Date().toISOString().slice(0, 10)) ||
    (applicant.place_offer_expires_at && applicant.place_offer_expires_at < new Date().toISOString());

  if (invalid) {
    return (
      <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="frame w-full max-w-sm p-3">
        <div className="sheet-entry p-8">
          <Link href="/" className="inline-block hover:opacity-80">
            <Wordmark size="hero" />
          </Link>
          <p className="mt-4 text-sm text-destructive">
            This offer link is invalid, expired, or has already been used. Contact the centre if you believe this is
            a mistake.
          </p>
        </div>
        </div>
      </div>
    );
  }

  const [{ data: course }, { data: center }] = await Promise.all([
    admin.from("courses").select("name, start_date, end_date").eq("id", applicant.intake_course_id).maybeSingle(),
    admin.from("centers").select("name, is_uk_centre, time_zone").eq("id", applicant.center_id).maybeSingle(),
  ]);
  // The place-offer deadline is an INSTANT, and it used to be printed in UTC
  // with "UTC" after it -- a 48-hour window that an applicant then had to
  // convert themselves, on the one page where getting it wrong costs them the
  // place. It is the centre's clock that runs out, so it is the centre's
  // clock that is shown, with the city named.
  const timeZone = center?.time_zone || DEFAULT_TIMEZONE;
  const centreCity = timeZone.split("/").pop()?.replace(/_/g, " ") ?? "";

  return (
    <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
      <div className="frame w-full max-w-sm p-3">
      <div className="sheet-entry p-8">
        <Link href="/" className="inline-block hover:opacity-80">
          <Wordmark size="hero" />
        </Link>
        <p className="mt-1 text-sm text-ink">
          {applicant.full_name}, you&apos;re offered a place on <strong>{course?.name}</strong>
          {course ? ` (${longDate(course.start_date)} – ${longDate(course.end_date)})` : ""} at {center?.name}.
        </p>
        {/* The accept-by date used to live inside the fee line, so an offer
            recorded without a fee showed no deadline at all -- on the page
            whose whole purpose is the deadline. They are two facts now. */}
        {applicant.fee_amount ? (
          <p className="mt-2 text-sm text-muted">
            Fee: {applicant.fee_amount}
            {applicant.fee_currency ? ` ${applicant.fee_currency}` : ""}.
          </p>
        ) : null}
        {applicant.offer_accept_by ? (
          <p className="mt-2 text-sm text-muted">Accept by {longDate(applicant.offer_accept_by)}.</p>
        ) : null}
        {applicant.place_offer_expires_at ? (
          <p className="mt-2 text-sm text-muted">
            This place is available until {formatDateTime(applicant.place_offer_expires_at, timeZone)}
            {centreCity ? ` in ${centreCity}` : ""}. After that, it goes to the next person on the waiting list.
          </p>
        ) : null}
        {applicant.workspace_released_at ? (
          <OfferAcceptForm
            token={token}
            isUkCentre={center?.is_uk_centre ?? false}
            defaultSpecialConsideration={applicant.special_requirements}
            fullName={applicant.full_name}
          />
        ) : (
          <p className="mt-4 text-sm text-muted">
            Once your deposit is recorded, you&apos;ll get an email with the same link, ready to set up your
            account. Nothing to do here yet.
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
