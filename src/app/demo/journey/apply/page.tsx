import { createAdminClient } from "@/lib/supabase/admin";
import { ApplicationForm } from "@/components/apply/application-form";

export const dynamic = "force-dynamic";

// The application form, bound to the DEMO centre, and safe to submit.
//
// Ramy, 3 Sep 2026: "the recording part, the actual recording. I wanna be able
// to record myself... the whole process should be in the journey."
//
// He couldn't. /apply is Elmswood's live form -- submitting it creates a real
// application at the real centre, which is why the journey labels it "look,
// don't submit". So the one interactive step at the very top of the journey
// was the one step nobody could take.
//
// This is the same ApplicationForm component, the same server action, the same
// recorder and the same validation, pointed at the demo centre instead. What
// it writes lands in the demo pipeline and is destroyed by the next reseed.
// Nothing here is a mock: record, submit, and the acknowledgement email, the
// transcription and the staff notifications all fire exactly as they do for a
// real applicant.
//
// The demo centres had no writing or speaking prompts at all until today, so
// the form rendered without the recorder even when pointed here -- seeded now
// in scripts/seed-demo-pipeline.mjs, which reruns on every rebuild.
export default async function DemoApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course: preselectedCourseId } = await searchParams;
  const admin = createAdminClient();

  // Oldest demo centre, matching every other /demo entry point: maybeSingle()
  // on is_demo throws the moment a second demo branch exists, which is exactly
  // how adding the Los Angeles branch took out the demo links once already.
  const { data: center } = await admin
    .from("centers")
    .select("id, name, logo_url, application_low_availability_threshold")
    .eq("is_demo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!center) {
    return (
      <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="frame w-full max-w-sm p-3">
          <div className="sheet-accent p-8 text-center">
            <p className="text-sm text-muted">There is no demo centre to apply to.</p>
          </div>
        </div>
      </div>
    );
  }

  const [{ data: openCourses }, { data: prompts }, { data: speakingPrompts }, { data: acceptedCounts }] = await Promise.all([
    admin
      .from("courses")
      .select("id, name, start_date, end_date, delivery_mode, application_cap")
      .eq("center_id", center.id)
      .eq("accepting_applications", true)
      .order("start_date", { ascending: true }),
    admin
      .from("application_writing_prompts")
      .select("id, prompt_type, prompt_text")
      .eq("center_id", center.id)
      .eq("active", true)
      .order("prompt_type"),
    admin
      .from("speaking_task_prompts")
      .select("id, prompt_text")
      .eq("center_id", center.id)
      .eq("active", true)
      .order("created_at"),
    admin.from("applicants").select("intake_course_id").eq("center_id", center.id).eq("stage", "accepted"),
  ]);

  const acceptedByCourse = new Map<string, number>();
  for (const row of acceptedCounts ?? []) {
    acceptedByCourse.set(row.intake_course_id, (acceptedByCourse.get(row.intake_course_id) ?? 0) + 1);
  }

  const intakes = (openCourses ?? []).map((c) => {
    const accepted = acceptedByCourse.get(c.id) ?? 0;
    const remaining = c.application_cap != null ? c.application_cap - accepted : null;
    let availabilityLabel: string;
    if (remaining === null) {
      availabilityLabel = "places available";
    } else if (remaining <= 0) {
      availabilityLabel = "full -- waiting list";
    } else if (remaining <= center.application_low_availability_threshold) {
      availabilityLabel = `${remaining} place${remaining === 1 ? "" : "s"} left`;
    } else {
      availabilityLabel = "places available";
    }
    return {
      id: c.id,
      name: c.name,
      startDate: c.start_date,
      endDate: c.end_date,
      deliveryMode: c.delivery_mode,
      availabilityLabel,
      full: remaining !== null && remaining <= 0,
    };
  });

  return (
    <div className="entry-ground flex min-h-screen flex-1 flex-col items-center justify-center gap-3 p-8">
      <div className="w-full max-w-xl rounded-[8px] border border-gold bg-card px-4 py-3">
        <p className="text-sm font-semibold text-ink">This one you can submit.</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          The real form, the real recorder, the real server action — pointed at {center.name} instead of a live centre. Record yourself, submit
          it, and watch the acknowledgement, the transcription and the staff notifications fire exactly as they do for a real applicant. What
          you write here lands in the demo pipeline and is wiped on the next rebuild.
        </p>
      </div>
      <div className="frame w-full max-w-xl p-3">
        <ApplicationForm
          centerId={center.id}
          centerName={center.name}
          centerLogoUrl={center.logo_url}
          intakes={intakes}
          prompts={prompts ?? []}
          speakingPrompts={speakingPrompts ?? []}
          preselectedCourseId={preselectedCourseId}
        />
      </div>
    </div>
  );
}
