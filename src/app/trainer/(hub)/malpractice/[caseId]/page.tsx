import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { CandidateAccountForm, DecisionForm } from "@/app/trainer/(hub)/malpractice/case-forms";

export default async function MalpracticeCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const trainer = await requireRole("trainer");
  const supabase = await createClient();

  const { data: caseRow } = await supabase
    .from("malpractice_cases")
    .select("*")
    .eq("id", caseId)
    .eq("course_id", trainer.course_id ?? "")
    .maybeSingle();
  if (!caseRow) notFound();

  const [{ data: trainee }, { data: assignment }, { data: openedBy }, { data: decidedBy }, { data: reflection }, { data: outcomeOptions }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", caseRow.trainee_id).maybeSingle(),
      supabase.from("assignments").select("assignment_type, due_date").eq("id", caseRow.assignment_id).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", caseRow.opened_by).maybeSingle(),
      caseRow.decided_by
        ? supabase.from("profiles").select("full_name").eq("id", caseRow.decided_by).maybeSingle()
        : Promise.resolve({ data: null }),
      caseRow.reflection_assignment_id
        ? supabase.from("assignments").select("id, first_status").eq("id", caseRow.reflection_assignment_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("malpractice_outcome_options").select("*").eq("center_id", trainer.center_id ?? "").order("created_at", { ascending: true }),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/portfolio/${caseRow.trainee_id}/assignments`} className="text-sm text-muted hover:text-primary">
        ← {trainee?.full_name ?? "Candidate"}&apos;s assignments
      </Link>

      <div className="sheet flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-serif text-xl text-ink">Malpractice case</h1>
          <span className={`pill ${caseRow.status === "open" ? "pill-warning" : "pill-neutral"}`}>
            {caseRow.status === "open" ? "Open — marking paused" : `Decided — ${caseRow.outcome}`}
          </span>
        </div>
        <p className="text-sm text-muted">
          {trainee?.full_name} · {assignment ? ASSIGNMENT_INFO[assignment.assignment_type]?.title ?? assignment.assignment_type : "Assignment"}{" "}
          ({caseRow.assignment_round === "first" ? "1st submission" : "resubmission"}) · opened by {openedBy?.full_name ?? "—"} on{" "}
          {new Date(caseRow.opened_at).toLocaleDateString()}
        </p>
      </div>

      {/* Malpractice.dc.html "1c The case": "a record an assessor can read
          end to end" -- a chronological timeline (opened -> candidate's
          account -> decision), not discrete unordered blocks. The next
          unfinished step's form renders inline, in its place in the
          sequence, rather than the whole page reflowing around it. */}
      <div className="sheet overflow-hidden !p-0">
        <TimelineRow
          date={caseRow.opened_at}
          step="Case opened"
          text={`Assignment marking paused${assignment ? ` on ${ASSIGNMENT_INFO[assignment.assignment_type]?.title ?? assignment.assignment_type}` : ""}.`}
          who={openedBy?.full_name ?? "—"}
        />
        {caseRow.candidate_account ? (
          <TimelineRow
            date={caseRow.candidate_account_recorded_at ?? caseRow.opened_at}
            step="Candidate's account"
            text={caseRow.candidate_account}
            who="Recorded by tutor"
          />
        ) : null}
        {caseRow.status === "decided" ? (
          <TimelineRow
            date={caseRow.decided_at ?? caseRow.opened_at}
            step="Decision"
            text={
              [
                caseRow.outcome,
                caseRow.flagged_for_referral ? "referred to the centre's malpractice procedure" : null,
                caseRow.decision_notes,
              ]
                .filter(Boolean)
                .join(" — ")
            }
            who={decidedBy?.full_name ?? "—"}
            last={!reflection}
          />
        ) : null}
        {reflection ? (
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <span className="text-xs text-muted">Plagiarism Reflection assignment created</span>
            <Link
              href={`/portfolio/${caseRow.trainee_id}/assignments/${reflection.id}`}
              className="shrink-0 rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-ink trainer-hover"
            >
              Open it →
            </Link>
          </div>
        ) : null}
      </div>

      {caseRow.status === "open" && !caseRow.candidate_account ? <CandidateAccountForm caseId={caseRow.id} /> : null}
      {caseRow.status === "open" && caseRow.candidate_account ? (
        <DecisionForm caseId={caseRow.id} outcomeOptions={outcomeOptions ?? []} />
      ) : null}
    </div>
  );
}

function TimelineRow({ date, step, text, who, last }: { date: string; step: string; text: string; who: string; last?: boolean }) {
  return (
    <div
      className={`grid grid-cols-[110px_150px_1fr_130px] items-start gap-4 px-5 py-3.5 ${last ? "" : "border-b border-border-faint"}`}
    >
      <span className="text-xs text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
        {new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
      </span>
      <span className="text-xs font-semibold text-ink">{step}</span>
      <span className="whitespace-pre-wrap text-sm text-ink">{text}</span>
      <span className="text-right text-xs text-muted">{who}</span>
    </div>
  );
}
