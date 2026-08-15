import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { FeedbackForm } from "@/app/dashboard/trainer/trainees/[id]/tp/[tpNumber]/feedback-form";

export default async function TrainerTpCardPage({
  params,
}: {
  params: Promise<{ id: string; tpNumber: string }>;
}) {
  const { id, tpNumber: tpNumberParam } = await params;
  const tpNumber = Number(tpNumberParam);
  if (!Number.isInteger(tpNumber) || tpNumber < 1 || tpNumber > 8) {
    notFound();
  }

  const trainer = await requireRole("trainer");
  const supabase = await createClient();

  const { data: trainee } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!trainee || trainee.course_id !== trainer.course_id || trainee.role !== "trainee") {
    notFound();
  }

  const { data: center } = await supabase
    .from("centers")
    .select("auto_tag_criteria_enabled")
    .eq("id", trainee.center_id)
    .maybeSingle();

  const { data: plan } = await supabase
    .from("tp_plans")
    .select("*")
    .eq("trainee_id", id)
    .eq("tp_number", tpNumber)
    .maybeSingle();

  if (!plan) {
    return (
      <div className="flex flex-col gap-6">
        <div className="card p-6">
          <h1 className="font-serif text-xl text-ink">
            {trainee.full_name} -- TP{tpNumber}
          </h1>
          <p className="mt-2 text-sm text-muted">The trainee hasn&apos;t started a lesson plan for this TP yet.</p>
          <Link href={`/dashboard/trainer/trainees/${id}`} className="mt-4 inline-block text-sm text-primary hover:underline">
            Back to {trainee.full_name}
          </Link>
        </div>
      </div>
    );
  }

  const [{ data: languageAnalysis }, { data: materials }, { data: selfEvaluation }, { data: feedback }, { data: captureNotes }] =
    await Promise.all([
      supabase.from("tp_language_analyses").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
      supabase.from("tp_materials").select("*").eq("tp_plan_id", plan.id).order("created_at"),
      supabase.from("tp_self_evaluations").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
      supabase.from("tp_feedback").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
      // specs/build-spec.md §7's mobile capture feature -- points jotted on
      // a phone during the lesson (src/app/trainer/(hub)/capture/), scoped
      // to this exact trainee+TP so they surface right where the trainer
      // writes the real feedback, not buried in a separate inbox.
      supabase
        .from("tp_capture_notes")
        .select("id, text, criteria_codes, captured_at")
        .eq("trainer_id", trainer.id)
        .eq("trainee_id", id)
        .eq("tp_number", tpNumber)
        .order("captured_at"),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">
            {trainee.full_name} -- TP{tpNumber}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {plan.submitted_at ? `Lesson plan submitted ${new Date(plan.submitted_at).toLocaleString()}` : "Draft in progress"}
          </p>
        </div>
        <Link href={`/dashboard/trainer/trainees/${id}`} className="shrink-0 rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary">
          Back to {trainee.full_name}
        </Link>
      </div>

      <div className="card p-6">
        <h2 className="font-serif text-lg text-ink">What they planned</h2>
        {!plan.submitted_at ? (
          <p className="mt-2 text-sm text-muted">Not submitted yet -- shown here as a live draft.</p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3">
          <ReadOnlyField label="Main Aims" value={plan.main_aims} />
          <ReadOnlyField label="Subsidiary Aims" value={plan.subsidiary_aims} />
          <ReadOnlyField label="Personal Aims" value={plan.personal_aims} />
          <ReadOnlyField label="Class Profile" value={plan.class_profile} />
          <ReadOnlyField label="Materials description" value={plan.materials_description} />
          {plan.anticipated_problems.length > 0 ? (
            <div>
              <p className="text-sm text-muted">Anticipated problems & solutions</p>
              <ul className="mt-1 flex flex-col gap-1">
                {plan.anticipated_problems.map((p, i) =>
                  p.problem || p.solution ? (
                    <li key={i} className="text-ink">
                      <b>Problem:</b> {p.problem} <b>Solution:</b> {p.solution}
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          ) : null}
          {plan.procedure.length > 0 ? (
            <div>
              <p className="text-sm text-muted">Procedure</p>
              <table className="mt-2 w-full min-w-[700px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Stage</th>
                    <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Procedure</th>
                    <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Interaction</th>
                    <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.procedure.map((row, i) => (
                    <tr key={i}>
                      <td className="border-b border-border-faint p-2 align-top text-ink">{row.stage}</td>
                      <td className="whitespace-pre-line border-b border-border-faint p-2 align-top text-ink">{row.procedure}</td>
                      <td className="border-b border-border-faint p-2 align-top text-ink">{row.interaction}</td>
                      <td className="border-b border-border-faint p-2 align-top text-ink">{row.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {languageAnalysis ? (
        <div className="card p-6">
          <h2 className="font-serif text-lg text-ink">Language Analysis ({languageAnalysis.type})</h2>
          {languageAnalysis.context ? <p className="mt-1 text-sm text-ink">{languageAnalysis.context}</p> : null}
          {languageAnalysis.type === "vocab" ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {languageAnalysis.vocab_rows.map((row, i) => (
                <li key={i} className="text-ink">
                  <b>{row.item}</b> -- {row.definition}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {languageAnalysis.blocks.map((block, i) => (
                <div key={i} className="text-sm text-ink">
                  <p className="font-medium">{block.item}</p>
                  {block.meaning ? <p className="text-muted">{block.meaning}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {materials && materials.length > 0 ? (
        <div className="card p-6">
          <h2 className="font-serif text-lg text-ink">Materials</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-ink">
            {materials.map((m) => (
              <li key={m.id}>{m.file_name ?? m.slides_url}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card p-6">
        <h2 className="font-serif text-lg text-ink">Self-evaluation</h2>
        {selfEvaluation?.submitted_at ? (
          <div className="mt-3 flex flex-col gap-3">
            <ReadOnlyField label="What went to plan?" value={selfEvaluation.what_went_well} />
            <ReadOnlyField label="What didn't go as planned, and why?" value={selfEvaluation.what_not_as_planned} />
            <ReadOnlyField label="Evidence of learning" value={selfEvaluation.evidence_of_learning} />
            <ReadOnlyField label="What I'd do differently" value={selfEvaluation.what_differently} />
            <ReadOnlyField label="Focus for next TP" value={selfEvaluation.next_tp_focus} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Not submitted yet.</p>
        )}
      </div>

      <FeedbackForm
        planId={plan.id}
        traineeId={id}
        tpNumber={tpNumber}
        feedback={feedback ?? null}
        autoTagEnabled={center?.auto_tag_criteria_enabled ?? true}
        captureNotes={captureNotes ?? []}
      />

      {plan.submitted_at && selfEvaluation?.submitted_at && feedback?.submitted_at ? (
        <a
          href={`/api/tp-plans/${plan.id}/pdf`}
          className="self-start rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
        >
          Download PDF record
        </a>
      ) : null}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="whitespace-pre-line text-ink">{value}</p>
    </div>
  );
}
