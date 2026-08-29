import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AcknowledgeButton } from "@/app/portfolio/[traineeId]/letters/[letterId]/acknowledge-button";
import { SignDeferralButton } from "@/app/portfolio/[traineeId]/letters/[letterId]/sign-deferral-button";
import type { FormalLetterInput } from "@/lib/formal-letter-pdf/document";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

const LETTER_TITLE: Record<string, string> = {
  fail_risk: "Notice of a potential Fail outcome",
  assignment_warning: "Notice following a failed assignment",
  deferral: "Deferral — centre record and candidate letter",
};

// Candidate-facing view of a formal letter -- RLS already scopes reads to
// the trainee's own rows, so this is "render what the scoped client
// returns", same pattern as every other candidate detail page.
export default async function FormalLetterPage({ params }: { params: Promise<{ traineeId: string; letterId: string }> }) {
  const session = await getCurrentProfile();
  const { traineeId, letterId } = await params;
  // Handbook 12.1.1 Section A puts these letters in the portfolio, so an
  // assessor has to be able to open one. They carry no Supabase session, so
  // the previous `if (!session?.profile) redirect("/login")` sent them to a
  // login they cannot use -- the same dead end the pack's own links had.
  const assessorCourseId = !session?.profile ? await getAssessorCourseId() : null;
  if (!session?.profile && !assessorCourseId) redirect("/login");
  const supabase = assessorCourseId ? createAdminClient() : await createClient();

  const { data: letter } = await supabase.from("formal_letters").select("*").eq("id", letterId).maybeSingle();
  if (!letter) notFound();
  // RLS scopes a candidate's own reads; an assessor reads through the admin
  // client, so the course check has to be made explicitly for them.
  if (assessorCourseId && letter.trainee_id !== traineeId) notFound();
  if (assessorCourseId) {
    const { data: subject } = await supabase.from("profiles").select("course_id").eq("id", traineeId).maybeSingle();
    if (subject?.course_id !== assessorCourseId) notFound();
  }

  const snapshot = letter.snapshot as unknown as FormalLetterInput;

  // Ramy, 28 Aug 2026: "the logic behind everything" -- issued_at/
  // acknowledged_at are real instants (timestamptz), not date-only strings;
  // formatting them with no explicit timeZone reads the server process's
  // own local time (UTC in production), not the trainee's centre, and can
  // show the wrong calendar day right around local midnight. Compliance-
  // adjacent for a formal letter, so worth the explicit fetch.
  const { data: traineeProfile } = await supabase.from("profiles").select("center_id").eq("id", traineeId).maybeSingle();
  const timeZone = traineeProfile?.center_id ? (await getCachedCenter(traineeProfile.center_id))?.time_zone ?? DEFAULT_TIMEZONE : DEFAULT_TIMEZONE;
  const formatLetterDate = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone }).format(new Date(iso));

  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/portfolio/${traineeId}`} label={"Course stream"} />

      <div className="sheet flex flex-col gap-3">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{snapshot.kicker ?? "Formal letter"}</p>
        <h1 className="font-serif text-xl text-ink">{LETTER_TITLE[letter.letter_type] ?? snapshot.docTitle}</h1>
        <p className="text-sm text-muted">Issued {formatLetterDate(letter.issued_at)}</p>

        <div className="flex flex-col gap-3 border-t border-border-faint pt-3">
          {snapshot.body.map((para, i) => (
            <p key={i} className="text-sm leading-relaxed text-ink">
              {para}
            </p>
          ))}
          {snapshot.list && snapshot.list.items.length > 0 ? (
            <div className="rounded-[6px] bg-surface-muted/40 p-3">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{snapshot.list.title}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {snapshot.list.items.map((item, i) => (
                  <li key={i} className="text-sm text-ink">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {snapshot.closing ? <p className="text-sm leading-relaxed text-ink">{snapshot.closing}</p> : null}
        </div>

        <a href={`/api/formal-letter/${letterId}`} className="self-start text-sm font-medium text-primary hover:underline">
          Download PDF →
        </a>

        <div className="border-t border-border-faint pt-3">
          {letter.acknowledged_at ? (
            <p className="text-sm font-semibold text-primary">
              {letter.letter_type === "deferral" && letter.candidate_signature_name
                ? `Signed by ${letter.candidate_signature_name} on `
                : "Acknowledged "}
              {formatLetterDate(letter.acknowledged_at)}
            </p>
          ) : !session?.profile ? (
            /* Acknowledging and signing are the candidate's own acts. An
               assessor reads the letter and whether it was acknowledged; they
               must never be handed the button that does it. */
            <p className="text-sm text-muted">Not yet acknowledged by the candidate.</p>
          ) : letter.letter_type === "deferral" ? (
            <SignDeferralButton letterId={letterId} signatureName={session.profile.signature_name} fullName={session.profile.full_name} />
          ) : (
            <AcknowledgeButton letterId={letterId} />
          )}
        </div>
      </div>
    </div>
  );
}
