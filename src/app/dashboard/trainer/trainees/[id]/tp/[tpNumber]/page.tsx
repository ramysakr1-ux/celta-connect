import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { getCentreGlossary } from "@/lib/centre-glossary";
import { BackLink } from "@/components/back-link";
import { FeedbackForm } from "@/app/dashboard/trainer/trainees/[id]/tp/[tpNumber]/feedback-form";
import { getFeedbackAssistState } from "@/lib/feedback-assist";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { formatDateTime, formatCalendarDate } from "@/lib/format-date";
import { tpLessonDate } from "@/lib/tp-lesson-date";

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
  // A plan is submitted at the centre's clock, not the reader's.
  const timeZone = (await getCachedCenter(trainer.center_id))?.time_zone ?? DEFAULT_TIMEZONE;

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
          <h1 className="font-serif text-h2 text-ink">
            {trainee.full_name} -- TP{tpNumber}
          </h1>
          <p className="mt-2 text-body text-muted">The trainee hasn&apos;t started a lesson plan for this TP yet.</p>
          <div className="mt-4">
            <BackLink href={`/dashboard/trainer/trainees/${id}`} label={trainee.full_name} />
          </div>
        </div>
      </div>
    );
  }

  const feedbackAssist = trainer.course_id ? await getFeedbackAssistState(trainer.course_id, trainer.id) : null;

  const [{ data: languageAnalysis }, { data: assignment }, { data: selfEvaluation }, { data: feedback }, { data: captureNotes }] =
    await Promise.all([
      supabase.from("tp_language_analyses").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
      supabase.from("plan_assignments").select("main_lesson_aim, tp_point_id").eq("trainee_id", id).eq("tp_number", tpNumber).maybeSingle(),
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

  const glossary = await getCentreGlossary(trainee.center_id);

  // The band's eyebrow reads TP · date · level · title, the same line the
  // candidate's own page shows. This page never passed them, so the tutor's
  // band said "Teaching Practice 4" and nothing else.
  const lessonDate = trainer.course_id ? await tpLessonDate(supabase, trainer.course_id, id, tpNumber) : null;
  const { data: point } = assignment?.tp_point_id
    ? await supabase.from("tp_points").select("tp_coursebook_id").eq("id", assignment.tp_point_id).maybeSingle()
    : { data: null };
  const { data: coursebook } = point?.tp_coursebook_id
    ? await supabase.from("tp_coursebooks").select("level").eq("id", point.tp_coursebook_id).maybeSingle()
    : { data: null };

  // Feedback writer A1 + A2, high-traffic audit 16 Sep 2026. This page used
  // to render the lesson plan as five read-only cards -- aims, class
  // profile, the whole procedure table, language analysis, materials, the
  // self-evaluation -- and then mount the writer, whose step 1 renders the
  // plan again with comment affordances and whose step 3 quotes the whole
  // self-evaluation. Every tutor, every TP, scrolled past two screens of
  // duplicate before they could write. The writer's step 1 IS the plan.
  //
  // What the head card carried -- name, TP, submitted-when, the way back --
  // is the band's sub-line and the pill above it, so the page is one object
  // in one register rather than a room card stacked on a document.
  return (
    <div className="flex flex-col gap-4">
      <div>
        <BackLink href={`/dashboard/trainer/trainees/${id}`} label={trainee.full_name} />
      </div>

      <FeedbackForm
        planId={plan.id}
        traineeId={id}
        traineeName={trainee.full_name}
        tpNumber={tpNumber}
        feedback={feedback ?? null}
        plan={plan}
        languageAnalysis={languageAnalysis ?? null}
        selfEvaluation={selfEvaluation ?? null}
        autoTagEnabled={center?.auto_tag_criteria_enabled ?? true}
        glossary={glossary}
        toneAssistEnabled={feedbackAssist?.enabled ?? false}
        captureNotes={captureNotes ?? []}
        lessonTitle={assignment?.main_lesson_aim ?? null}
        lessonWhen={lessonDate ? formatCalendarDate(lessonDate, { weekday: "long", day: "numeric", month: "long" }) : null}
        level={coursebook?.level ?? null}
        subLine={`${trainee.full_name} · ${plan.submitted_at ? `Lesson plan submitted ${formatDateTime(plan.submitted_at, timeZone)}` : "Lesson plan still in draft"}`}
      />

      {plan.submitted_at && selfEvaluation?.submitted_at && feedback?.submitted_at ? (
        <a
          href={`/api/tp-plans/${plan.id}/pdf`}
          className="self-start rounded-[6px] border border-border px-4 py-2 text-body text-ink hover:border-primary"
        >
          Download PDF record
        </a>
      ) : null}
    </div>
  );
}
