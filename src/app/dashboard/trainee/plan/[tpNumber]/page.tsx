import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { DENSITY_TIER_LABELS } from "@/lib/tp-density";
import { LessonPlanForm } from "@/app/dashboard/trainee/plan/[tpNumber]/lesson-plan-form";
import { MaterialsSection } from "@/app/dashboard/trainee/plan/[tpNumber]/materials-section";
import { SelfEvaluationSection } from "@/app/dashboard/trainee/plan/[tpNumber]/self-evaluation-section";

export default async function TpPlanDetailPage({
  params,
}: {
  params: Promise<{ tpNumber: string }>;
}) {
  const { tpNumber: tpNumberParam } = await params;
  const tpNumber = Number(tpNumberParam);
  if (!Number.isInteger(tpNumber) || tpNumber < 1 || tpNumber > 6) {
    notFound();
  }

  const trainee = await requireRole("trainee");
  const supabase = await createClient();

  const [{ data: assignment }, { data: plan }] = await Promise.all([
    supabase
      .from("plan_assignments")
      .select("*")
      .eq("trainee_id", trainee.id)
      .eq("tp_number", tpNumber)
      .maybeSingle(),
    supabase.from("tp_plans").select("*").eq("trainee_id", trainee.id).eq("tp_number", tpNumber).maybeSingle(),
  ]);

  if (!assignment) {
    return (
      <div className="flex flex-col gap-6">
        <div className="card p-6">
          <h1 className="font-serif text-xl text-ink">TP{tpNumber}</h1>
          <p className="mt-2 text-muted">
            Not yet assigned -- your trainer will unlock this closer to the time.
          </p>
          <Link
            href="/dashboard/trainee/plan"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Back to your lesson plans
          </Link>
        </div>
      </div>
    );
  }

  const [{ data: languageAnalysis }, { data: materials }, { data: selfEvaluation }, { data: feedback }] = plan
    ? await Promise.all([
        supabase.from("tp_language_analyses").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
        supabase.from("tp_materials").select("*").eq("tp_plan_id", plan.id).order("created_at"),
        supabase.from("tp_self_evaluations").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
        supabase.from("tp_feedback").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
      ])
    : [{ data: null }, { data: [] }, { data: null }, { data: null }];

  let previousActionPoints: string[] = [];
  if (tpNumber > 1) {
    const { data: previousPlan } = await supabase
      .from("tp_plans")
      .select("id")
      .eq("trainee_id", trainee.id)
      .eq("tp_number", tpNumber - 1)
      .maybeSingle();
    if (previousPlan) {
      const { data: previousFeedback } = await supabase
        .from("tp_feedback")
        .select("action_points_planning, action_points_teaching")
        .eq("tp_plan_id", previousPlan.id)
        .maybeSingle();
      previousActionPoints = [
        ...(previousFeedback?.action_points_planning ?? []),
        ...(previousFeedback?.action_points_teaching ?? []),
      ]
        .filter((p) => p.starred)
        .map((p) => p.text);
    }
  }

  const tier = assignment.density_tier;
  const label = DENSITY_TIER_LABELS[tier];

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">TP{tpNumber} -- Lesson plan</h1>
          <p className="mt-1 text-sm text-muted">
            Write your own lesson plan below, using the assigned brief as a starting point.
            Submitting locks it as your record of the lesson.
          </p>
        </div>
        <Link
          href="/dashboard/trainee/plan"
          className="shrink-0 rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
        >
          All lesson plans
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif text-lg text-ink">Assigned brief</h2>
          <span className="badge-solid">{label.name}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{label.blurb}</p>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <p className="text-sm text-muted">Main aim</p>
            <p className="text-ink">{assignment.main_lesson_aim}</p>
          </div>
          {assignment.sub_aim ? (
            <div>
              <p className="text-sm text-muted">Sub aim</p>
              <p className="text-ink">{assignment.sub_aim}</p>
            </div>
          ) : null}
          {assignment.materials_description ? (
            <div>
              <p className="text-sm text-muted">Materials</p>
              <p className="text-ink">{assignment.materials_description}</p>
            </div>
          ) : null}
          {assignment.page_references ? (
            <div>
              <p className="text-sm text-muted">Page references</p>
              <p className="text-ink">{assignment.page_references}</p>
            </div>
          ) : null}
        </div>
      </div>

      <LessonPlanForm tpNumber={tpNumber} plan={plan} languageAnalysis={languageAnalysis ?? null} />

      {plan ? (
        <MaterialsSection
          tpPlanId={plan.id}
          centerId={trainee.center_id}
          traineeId={trainee.id}
          materials={materials ?? []}
          locked={Boolean(plan.submitted_at)}
        />
      ) : (
        <div className="card p-6">
          <h2 className="font-serif text-lg text-ink">Materials</h2>
          <p className="mt-2 text-sm text-muted">
            Save your lesson plan first -- materials attach to it once it exists.
          </p>
        </div>
      )}

      <SelfEvaluationSection
        tpNumber={tpNumber}
        plan={plan ?? null}
        taught={Boolean(assignment.taught_at)}
        selfEvaluation={selfEvaluation ?? null}
        previousActionPoints={previousActionPoints}
        feedback={feedback ?? null}
      />

      {plan?.submitted_at && selfEvaluation?.submitted_at && feedback?.submitted_at ? (
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
