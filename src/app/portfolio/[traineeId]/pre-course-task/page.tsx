import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { PreCourseTaskForm } from "@/app/portfolio/[traineeId]/pre-course-task/pre-course-task-form";

// Checkpoint 12 (build-spec.md item 18) -- Cambridge's Pre-Course Task
// (C) UCLES 2018, five sections, plus a centre supplement (online teaching,
// use of L1). Ungraded, handed in on day one. Same single-file role-branch
// pattern as CELTA5's page: trainee edits their own, staff/assessor see the
// same content read-only -- not the TP/assignments dual-route pattern,
// since there's no trainer-authored feedback layered on top of this one.
export default async function PreCourseTaskPage({ params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();
  if (viewer && !isStaff && viewer.id !== traineeId) notFound();

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase.from("profiles").select("id, full_name, center_id, course_id").eq("id", traineeId).maybeSingle();
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();
  if (viewer?.role === "trainer" && trainee.course_id !== viewer.course_id) notFound();

  const [{ data: sections }, { data: responses }] = await Promise.all([
    // Split into two arrays below by source, each already in the right
    // order via sequence_index -- no need for the query itself to interleave
    // cambridge/centre_supplement correctly.
    supabase.from("pre_course_task_sections").select("*").eq("center_id", trainee.center_id).order("sequence_index"),
    supabase.from("pre_course_task_responses").select("*").eq("trainee_id", traineeId),
  ]);

  const responseTextBySection: Record<string, string> = {};
  for (const r of responses ?? []) responseTextBySection[r.section_id] = r.response ?? "";
  const cambridgeSections = (sections ?? []).filter((s) => s.source === "cambridge");
  const supplementSections = (sections ?? []).filter((s) => s.source === "centre_supplement");
  const isEditable = !isStaff && !assessorCourseId;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Pre-course task</p>
        <h2 className="font-serif text-2xl text-ink">Cambridge&apos;s Pre-Course Task, plus your centre&apos;s supplement</h2>
        <p className="mt-1 text-sm text-muted">
          Ungraded -- handed in on day one so your tutor can see where the group is starting from.
        </p>
      </div>

      <PreCourseTaskForm
        traineeId={traineeId}
        cambridgeSections={cambridgeSections}
        supplementSections={supplementSections}
        responseTextBySection={responseTextBySection}
        isEditable={isEditable}
      />
    </div>
  );
}
