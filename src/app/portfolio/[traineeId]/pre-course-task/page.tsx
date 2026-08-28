import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { mostRecentFridayBefore } from "@/lib/starts-monday-cron";
import { PreCourseTaskSections } from "@/app/portfolio/[traineeId]/pre-course-task/pre-course-task-sections";
import { ScavengerHuntPanel } from "@/app/portfolio/[traineeId]/pre-course-task/scavenger-hunt-panel";
import type { Database } from "@/lib/supabase/types";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

type Item = Database["public"]["Tables"]["pre_course_task_items"]["Row"];

// Checkpoint 12 (build-spec.md item 18) -- Cambridge's Pre-Course Task
// (C) UCLES 2018, five sections, plus a centre supplement (online teaching,
// use of L1).
//
// Ramy, 28 Aug 2026: "Who said everything has happened on paper? It's not
// happening on paper. It's happening here." Reverses the 27 Aug model,
// where this page was a read-only reader and candidates worked on paper for
// a tutor to read on day one. Candidates now answer inside Connect
// (pre_course_task_responses, continuous autosave, no submit step), staff
// see those answers read-only on this same page, and progress is measured
// in tasks answered rather than sections self-ticked. The answer key still
// unlocks cohort-wide on the Friday before start, not per-candidate.
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

  const { data: sections } = await supabase
    .from("pre_course_task_sections")
    .select("*")
    .eq("center_id", trainee.center_id)
    .order("sequence_index");
  const sectionIds = (sections ?? []).map((s) => s.id);

  const [{ data: items }, { data: progress }, { data: course }, { data: huntProgress }, { data: responses }] = await Promise.all([
    sectionIds.length > 0
      ? supabase.from("pre_course_task_items").select("*").in("section_id", sectionIds).order("sequence_index")
      : Promise.resolve({ data: [] }),
    supabase.from("pre_course_task_progress").select("section_id, completed_at").eq("trainee_id", traineeId),
    trainee.course_id ? supabase.from("courses").select("start_date").eq("id", trainee.course_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("scavenger_hunt_progress").select("question_key").eq("trainee_id", traineeId),
    supabase.from("pre_course_task_responses").select("item_id, response").eq("trainee_id", traineeId),
  ]);

  const itemsBySection = new Map<string, Item[]>();
  for (const item of (items ?? []) as Item[]) {
    const list = itemsBySection.get(item.section_id) ?? [];
    list.push(item);
    itemsBySection.set(item.section_id, list);
  }
  const completedSectionIds = new Set((progress ?? []).filter((p) => p.completed_at).map((p) => p.section_id));
  const responsesByItemId = new Map((responses ?? []).map((r) => [r.item_id, r.response]));
  const huntFoundKeys = new Set((huntProgress ?? []).map((p) => p.question_key));

  const cambridgeSections = (sections ?? []).filter((s) => s.source === "cambridge");
  const supplementSections = (sections ?? []).filter((s) => s.source === "centre_supplement");
  const isTraineeViewer = !isStaff && !assessorCourseId;

  // Staff/assessor always see the answer key (they already have access to
  // everything else) -- gating is a candidate-facing pacing device, same
  // reasoning as assignment gating.
  // Ramy, 28 Aug 2026: "the logic behind everything" -- was the server's
  // UTC date, wrong for this real trainee-facing eligibility gate.
  const timeZone = (await getCachedCenter(trainee.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);
  const answerKeyUnlocked = !isTraineeViewer || (course?.start_date ? today >= mostRecentFridayBefore(course.start_date) : false);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Pre-course task</p>
        <h2 className="font-serif text-2xl text-ink">Cambridge&apos;s Pre-Course Task, plus your centre&apos;s supplement</h2>
        <p className="mt-1 text-sm text-muted">
          About 4 hours total. You answer it here and it saves as you go -- nothing to print, nothing to hand in. It is
          not graded and not counted as coursework, but your tutor reads it before day one. Work through it in several
          sittings rather than one; that is Cambridge&apos;s own advice, and the grammar section rewards it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <PreCourseTaskSections
          cambridgeSections={cambridgeSections}
          supplementSections={supplementSections}
          itemsBySection={itemsBySection}
          completedSectionIds={completedSectionIds}
          answerKeyUnlocked={answerKeyUnlocked}
          isEditable={isTraineeViewer}
          responsesByItemId={responsesByItemId}
        />
        <ScavengerHuntPanel foundKeys={huntFoundKeys} />
      </div>
    </div>
  );
}
