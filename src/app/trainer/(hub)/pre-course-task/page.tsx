import Link from "next/link";
import { responseIsAnswered } from "@/lib/pre-course-task-shape";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { answerKeyOpensOn } from "@/lib/pre-course-answer-key";

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
  // Ramy, 28 Aug 2026: candidates answer the task inside Connect now, so
  // this grid counts real answers per section instead of the section-level
  // "Mark done" self-report it used to read -- that pill is gone, and a
  // tick a candidate gave themselves was never evidence they had written
  // anything anyway. responseIsAnswered is shared with the candidate's own
  // page and the roster column, so all three agree.
  const { data: sectionItems } =
    (sections ?? []).length > 0
      ? await supabase
          .from("pre_course_task_items")
          .select("id, section_id")
          .in(
            "section_id",
            (sections ?? []).map((s) => s.id)
          )
      : { data: [] };
  const { data: responses } =
    traineeIds.length > 0
      ? await supabase.from("pre_course_task_responses").select("trainee_id, item_id, response").in("trainee_id", traineeIds)
      : { data: [] };

  const sectionIdByItemId = new Map((sectionItems ?? []).map((i) => [i.id, i.section_id]));
  const itemCountBySection = new Map<string, number>();
  for (const i of sectionItems ?? []) itemCountBySection.set(i.section_id, (itemCountBySection.get(i.section_id) ?? 0) + 1);

  const answeredBySectionAndTrainee = new Map<string, number>();
  for (const r of responses ?? []) {
    if (!responseIsAnswered(r.response)) continue;
    const sectionId = sectionIdByItemId.get(r.item_id);
    if (!sectionId) continue;
    const key = `${r.trainee_id}:${sectionId}`;
    answeredBySectionAndTrainee.set(key, (answeredBySectionAndTrainee.get(key) ?? 0) + 1);
  }

  const cambridgeSections = (sections ?? []).filter((s) => s.source === "cambridge");
  const supplementSections = (sections ?? []).filter((s) => s.source === "centre_supplement");
  const orderedSections = [...cambridgeSections, ...supplementSections];

  const today = new Date().toISOString().slice(0, 10);
  const answerKeyDate = course.start_date ? answerKeyOpensOn(course.start_date) : null;
  const answerKeyOpen = Boolean(answerKeyDate && today >= answerKeyDate);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Pre-course task</p>
        <h1 className="font-serif text-2xl text-ink">Who&apos;s answered what</h1>
        <p className="mt-1 text-sm text-muted">
          Answered in Connect and never submitted -- candidates type into the task itself and it saves as they go.
          This counts tasks actually answered per section; open a name to read their answers.
        </p>
        {answerKeyDate ? (
          <p className="mt-1 text-xs text-muted">
            Answer key {answerKeyOpen ? "opened" : "opens"} {answerKeyDate} -- 48 hours before the course starts,
            cohort-wide. A candidate only sees the answer to a task once they have answered it themselves; you see all
            of them regardless.
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
                const answeredTotal = orderedSections.reduce((n, s) => n + (answeredBySectionAndTrainee.get(`${t.id}:${s.id}`) ?? 0), 0);
                const itemsTotal = orderedSections.reduce((n, s) => n + (itemCountBySection.get(s.id) ?? 0), 0);
                return (
                  <tr key={t.id} className="border-b border-border-faint last:border-none hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/portfolio/${t.id}/pre-course-task`} className="text-ink hover:text-primary">
                        {t.full_name}
                      </Link>
                    </td>
                    {orderedSections.map((s) => {
                      const answered = answeredBySectionAndTrainee.get(`${t.id}:${s.id}`) ?? 0;
                      const sectionItemCount = itemCountBySection.get(s.id) ?? 0;
                      const complete = sectionItemCount > 0 && answered >= sectionItemCount;
                      return (
                        <td key={s.id} className="px-0.5 py-2.5 text-center">
                          <span
                            title={sectionItemCount > 0 ? `${answered} of ${sectionItemCount} answered` : "No tasks in this section yet"}
                            className={`inline-flex h-[22px] w-[34px] items-center justify-center rounded-[5px] text-[11px] font-medium tabular-nums ${
                              complete ? "status-pill status-pill-on-track" : "border border-dashed border-border-faint text-muted"
                            }`}
                          >
                            {sectionItemCount === 0 ? "--" : `${answered}/${sectionItemCount}`}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-center text-xs font-medium text-muted">
                      {answeredTotal} of {itemsTotal}
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
