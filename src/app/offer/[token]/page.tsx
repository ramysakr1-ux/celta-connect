import { createAdminClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/wordmark";
import { OfferAcceptForm } from "@/app/offer/[token]/offer-accept-form";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// "Accepting is what creates the account." The public offer-acceptance
// page -- looks up by offer_token (public.applicants.offer_token, minted
// when a decider records an offer, src/app/dashboard/admissions/actions.ts
// sendOffer). Same unified sheet-accent entry-moment look as /join/[token].
export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: applicant } = await admin.from("applicants").select("*").eq("offer_token", token).maybeSingle();

  const invalid =
    !applicant ||
    applicant.stage !== "offer_sent" ||
    (applicant.offer_accept_by && applicant.offer_accept_by < new Date().toISOString().slice(0, 10));

  if (invalid) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="sheet-accent w-full max-w-sm p-8">
          <Wordmark size="hero" />
          <p className="mt-4 text-sm text-destructive">
            This offer link is invalid, expired, or has already been used. Contact the centre if you believe this is
            a mistake.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: course }, { data: center }] = await Promise.all([
    admin.from("courses").select("name, start_date, end_date").eq("id", applicant.intake_course_id).maybeSingle(),
    admin.from("centers").select("name, is_uk_centre").eq("id", applicant.center_id).maybeSingle(),
  ]);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-8">
      <div className="sheet-accent w-full max-w-sm p-8">
        <Wordmark size="hero" />
        <p className="mt-1 text-sm text-ink">
          {applicant.full_name}, you&apos;re offered a place on <strong>{course?.name}</strong>
          {course ? ` (${formatDate(course.start_date)} – ${formatDate(course.end_date)})` : ""} at {center?.name}.
        </p>
        {applicant.fee_amount ? (
          <p className="mt-2 text-sm text-muted">
            Fee: {applicant.fee_amount}
            {applicant.fee_currency ? ` ${applicant.fee_currency}` : ""}. Accept by {formatDate(applicant.offer_accept_by!)}.
          </p>
        ) : null}
        <OfferAcceptForm token={token} isUkCentre={center?.is_uk_centre ?? false} defaultSpecialConsideration={applicant.special_requirements} />
      </div>
    </div>
  );
}
