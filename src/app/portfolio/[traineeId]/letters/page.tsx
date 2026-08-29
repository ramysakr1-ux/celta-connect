import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";

// Handbook 12.1.1 Section A, "where appropriate": a fail warning letter and a
// candidate letter of withdrawal belong in the portfolio. 14.2 also has the
// assessor "check documentation for any candidate who has withdrawn from the
// course (e.g., letter confirming withdrawal)".
//
// Ramy, 30 Aug 2026: "if there was a fail letter or something to do with
// plagiarism, that could live in a third pill... that should be part of the
// portfolio, obviously." It should, and it wasn't reachable at all: the
// letters existed and had a detail page, but nothing indexed them and the
// detail page turned away anyone without a candidate session.
//
// Malpractice cases sit here too rather than in their own place. From the
// assessor's side they are the same question -- what formal action has this
// centre taken about this candidate, and is it documented.

const LETTER_TITLE: Record<string, string> = {
  fail_risk: "Notice of a potential Fail outcome",
  assignment_warning: "Notice following a failed assignment",
  deferral: "Deferral — centre record and candidate letter",
};

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function CandidateLettersPage({ params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;

  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin" || viewer?.role === "platform_owner";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  const isOwnRecord = viewer?.id === traineeId;
  if (!isStaff && !assessorCourseId && !isOwnRecord) notFound();

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const admin = createAdminClient();

  const { data: trainee } = await supabase.from("profiles").select("full_name, course_id").eq("id", traineeId).maybeSingle();
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const [{ data: letters }, { data: cases }] = await Promise.all([
    admin
      .from("formal_letters")
      .select("id, letter_type, issued_at, acknowledged_at")
      .eq("trainee_id", traineeId)
      .order("issued_at", { ascending: false }),
    admin
      .from("malpractice_cases")
      .select("id, opened_at, assignment_round, candidate_account_recorded_at")
      .eq("trainee_id", traineeId)
      .order("opened_at", { ascending: false }),
  ]);

  const nothing = (letters ?? []).length === 0 && (cases ?? []).length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-2xl text-ink">{trainee.full_name} — letters and cases</h1>
        <p className="mt-1 text-sm text-muted">
          Formal letters and any malpractice case raised about this candidate. Handbook §12.1.1 Section A keeps the fail
          warning and withdrawal letters in the portfolio &ldquo;where appropriate&rdquo;.
        </p>
      </div>

      {nothing ? (
        <div className="card p-5 text-sm text-muted">
          Nothing formal has been issued or raised about this candidate &mdash; no fail warning, no withdrawal letter, no
          malpractice case. That is the ordinary state for most candidates, and it is recorded here rather than left
          blank so the absence is visibly checked rather than merely unseen.
        </div>
      ) : null}

      {(letters ?? []).map((l) => (
        <Link
          key={l.id}
          href={`/portfolio/${traineeId}/letters/${l.id}`}
          className="assessor-hover card flex items-start justify-between gap-4 p-5 no-underline"
        >
          <span>
            <span className="block text-[13.5px] font-semibold text-ink">
              {LETTER_TITLE[l.letter_type] ?? l.letter_type}
            </span>
            <span className="mt-0.5 block text-[12.5px] text-muted">
              Issued {longDate(l.issued_at)}.{" "}
              {l.acknowledged_at ? `Acknowledged by the candidate ${longDate(l.acknowledged_at)}.` : "Not yet acknowledged."}
            </span>
          </span>
          <span className="shrink-0 pt-0.5 text-[11px] font-semibold text-primary">Open →</span>
        </Link>
      ))}

      {(cases ?? []).map((c) => (
        <div key={c.id} className="card p-5">
          <p className="text-[13.5px] font-semibold text-ink">Malpractice case</p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Opened {longDate(c.opened_at)} on the {c.assignment_round === "resubmission" ? "resubmission" : "first submission"}.{" "}
            {c.candidate_account_recorded_at
              ? "The candidate's own account is on the record."
              : "The candidate's account has not been recorded yet."}
          </p>
          <p className="mt-2 text-[11.5px] text-muted">
            The full case, including the outcome, is on the course&apos;s malpractice screen in the pack.
          </p>
        </div>
      ))}
    </div>
  );
}
