import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { mostRecentFridayBefore } from "@/lib/starts-monday-cron";

// Checkpoint 12 -- "aggregate view for the tutor" (build-spec.md item 18).
// Rebuilt 27 Aug 2026 against for-claude-code-pre-course-task-screens.md:
// the task is done on paper and never submitted, so there is no text left
// to skim here any more -- this is purely a section-level completion
// tracker (who's read what) plus the answer-key unlock date, not a marking
// view. The old "what the cohort said" response-aggregation panel is gone
// along with pre_course_task_responses -- there was never real content to
// aggregate once nothing is typed.
export default async function TrainerPreCourseTaskPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" || session?.profile?.role === "platform_owner" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }

  const { data: course } = await supabase.from("courses").select("center_id, start_date").eq("id", courseId).maybeSingle();
  if (!course) {
    return <div className="sheet p-6 text-sm text-muted">Course not found.</div>;
  }

  const { data: trainees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("course_id", courseId)
    .eq("role", "trainee")
    .order("full_name");

  const { data: sections } = await supabase
    .from("pre_course_task_sections")
    .select("id, source, sequence_index, title")
    .eq("center_id", course.center_id)
    .order("sequence_index");

  const traineeIds = (trainees ?? []).map((t) => t.id);
  const { data: progress } =
    traineeIds.length > 0
      ? await supabase.from("pre_course_task_progress").select("trainee_id, section_id, completed_at").in("trainee_id", traineeIds)
      : { data: [] };

  const doneSet = new Set((progress ?? []).filter((p) => p.completed_at).map((p) => `${p.trainee_id}:${p.section_id}`));

  const cambridgeSections = (sections ?? []).filter((s) => s.source === "cambridge");
  const supplementSections = (sections ?? []).filter((s) => s.source === "centre_supplement");
  const orderedSections = [...cambridgeSections, ...supplementSections];

  const today = new Date().toISOString().slice(0, 10);
  const answerKeyDate = course.start_date ? mostRecentFridayBefore(course.start_date) : null;
  const answerKeyOpen = Boolean(answerKeyDate && today >= answerKeyDate);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Pre-course task</p>
        <h1 className="font-serif text-2xl text-ink">Who&apos;s read what</h1>
        <p className="mt-1 text-sm text-muted">
          Done on paper, never submitted -- this tracks section-level progress, not answers. Candidates read their
          own paper copy on day one.
        </p>
        {answerKeyDate ? (
          <p className="mt-1 text-xs text-muted">
            Answer key {answerKeyOpen ? "opened" : "opens"} {answerKeyDate} -- cohort-wide, not per-candidate.
          </p>
        ) : null}
      </div>

      {orderedSections.length === 0 ? (
        <div className="sheet text-sm text-muted">No pre-course task sections set up for this centre yet.</div>
      ) : (trainees ?? []).length === 0 ? (
        <div className="sheet text-sm text-muted">No candidates on this course yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-[6px] border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Candidate</th>
                {orderedSections.map((s) => (
                  <th key={s.id} className="w-[40px] px-0.5 py-2.5 text-center text-[10px] font-semibold text-muted" title={s.title}>
                    {s.source === "cambridge" ? "C" : "S"}
                    {s.sequence_index}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Total</th>
              </tr>
            </thead>
            <tbody>
              {(trainees ?? []).map((t) => {
                const doneCount = orderedSections.filter((s) => doneSet.has(`${t.id}:${s.id}`)).length;
                return (
                  <tr key={t.id} className="border-b border-border-faint last:border-none hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/portfolio/${t.id}/pre-course-task`} className="text-ink hover:text-primary">
                        {t.full_name}
                      </Link>
                    </td>
                    {orderedSections.map((s) => {
                      const done = doneSet.has(`${t.id}:${s.id}`);
                      return (
                        <td key={s.id} className="px-0.5 py-2.5 text-center">
                          <span
                            title={done ? "Done" : "Not done yet"}
                            className={`inline-flex h-[22px] w-[26px] items-center justify-center rounded-[5px] text-xs font-medium ${
                              done ? "status-pill status-pill-on-track" : "border border-dashed border-border-faint text-muted"
                            }`}
                          >
                            {done ? "✓" : "--"}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-center text-xs font-medium text-muted">
                      {doneCount} of {orderedSections.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        <span>C = Cambridge&apos;s Pre-Course Task</span>
        <span>S = your centre&apos;s supplement</span>
      </div>
    </div>
  );
}
