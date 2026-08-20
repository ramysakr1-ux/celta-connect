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

      {caseRow.candidate_account ? (
        <div className="sheet flex flex-col gap-2">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Candidate&apos;s account</p>
          <p className="whitespace-pre-wrap text-sm text-ink">{caseRow.candidate_account}</p>
          <p className="text-xs text-muted">
            Recorded {caseRow.candidate_account_recorded_at ? new Date(caseRow.candidate_account_recorded_at).toLocaleString() : ""}
          </p>
        </div>
      ) : caseRow.status === "open" ? (
        <CandidateAccountForm caseId={caseRow.id} />
      ) : null}

      {caseRow.status === "open" && caseRow.candidate_account ? (
        <DecisionForm caseId={caseRow.id} outcomeOptions={outcomeOptions ?? []} />
      ) : null}

      {caseRow.status === "decided" ? (
        <div className="sheet flex flex-col gap-2">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Decision</p>
          <p className="text-sm text-ink">
            {caseRow.outcome} · {decidedBy?.full_name ?? "—"} ·{" "}
            {caseRow.decided_at ? new Date(caseRow.decided_at).toLocaleString() : ""}
          </p>
          {caseRow.flagged_for_referral ? (
            <p className="text-xs font-semibold text-gold">Referred to the centre&apos;s malpractice procedure</p>
          ) : null}
          {caseRow.decision_notes ? <p className="whitespace-pre-wrap text-sm text-muted">{caseRow.decision_notes}</p> : null}
          {reflection ? (
            <Link
              href={`/portfolio/${caseRow.trainee_id}/assignments/${reflection.id}`}
              className="mt-1 self-start rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-ink hover:border-primary"
            >
              Open the Plagiarism Reflection assignment →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
