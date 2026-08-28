import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { WithdrawalRequestForm } from "@/app/portfolio/[traineeId]/withdrawal-request/withdrawal-request-form";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

// connect-withdrawal-precourse-scope-spec-2026-08-21.md item 2: the
// candidate's own self-serve request, separate from the staff-initiated
// flow in withdraw-card.tsx. Reached the same quiet-footer-link way as
// Raise a concern, not a nav tab.
export default async function WithdrawalRequestPage({ params }: { params: Promise<{ traineeId: string }> }) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const { traineeId } = await params;
  if (session.profile.id !== traineeId) notFound();

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, signature_name, course_status, center_id").eq("id", traineeId).maybeSingle();
  if (!profile) notFound();
  // Ramy, 28 Aug 2026: "the logic behind everything" -- created_at is a real
  // instant; formatting it with no timeZone read the server's own local
  // time, not the trainee's centre.
  const timeZone = profile.center_id ? (await getCachedCenter(profile.center_id))?.time_zone ?? DEFAULT_TIMEZONE : DEFAULT_TIMEZONE;

  const { data: existingRequest } = await supabase
    .from("withdrawal_requests")
    .select("kind, status, created_at, actioned_at")
    .eq("trainee_id", traineeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/portfolio/${traineeId}`} className="text-xs text-muted hover:text-primary">
        ← Course stream
      </Link>

      <div className="sheet flex flex-col gap-4">
        <div>
          <h1 className="font-serif text-xl text-ink">Leaving or deferring the course</h1>
          <p className="mt-1 text-sm text-muted">
            A few questions produce the letter, rather than you having to write one. This sends a request to the
            centre -- it doesn&apos;t take effect until a tutor actions it.
          </p>
        </div>

        {profile.course_status !== "active" ? (
          <p className="rounded-[6px] border border-border-faint bg-surface-muted/40 p-4 text-sm text-ink">
            Your course status has already been recorded. Talk to your tutor if you think this is wrong.
          </p>
        ) : existingRequest?.status === "pending" ? (
          <div className="rounded-[6px] border border-border-faint bg-surface-muted/40 p-4">
            <p className="text-sm font-semibold text-primary">Sent -- waiting for the centre.</p>
            <p className="mt-1 text-sm text-muted">
              Your {existingRequest.kind === "withdraw" ? "withdrawal" : "deferral"} request was sent{" "}
              {new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date(existingRequest.created_at))}. A tutor will act on it and follow
              up with you.
            </p>
          </div>
        ) : (
          <WithdrawalRequestForm traineeId={traineeId} fullName={profile.full_name} signatureName={profile.signature_name} />
        )}
      </div>
    </div>
  );
}
