import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";

// Checkpoint 12 -- "aggregate view for the tutor" (build-spec.md item 18).
// Ungraded, so this is a completion-tracking view (who's handed in what),
// not a marking view -- full responses are read on the candidate's own
// portfolio page (already staff-readable via that page's role branch).
export default async function TrainerPreCourseTaskPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }

  const { data: course } = await supabase.from("courses").select("center_id").eq("id", courseId).maybeSingle();
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
  const { data: responses } =
    traineeIds.length > 0
      ? await supabase.from("pre_course_task_responses").select("trainee_id, section_id, response").in("trainee_id", traineeIds)
      : { data: [] };

  const answeredSet = new Set(
    (responses ?? []).filter((r) => r.response && r.response.trim() !== "").map((r) => `${r.trainee_id}:${r.section_id}`)
  );
  const nameById = new Map((trainees ?? []).map((t) => [t.id, t.full_name]));

  const cambridgeSections = (sections ?? []).filter((s) => s.source === "cambridge");
  const supplementSections = (sections ?? []).filter((s) => s.source === "centre_supplement");
  const orderedSections = [...cambridgeSections, ...supplementSections];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Pre-course task</p>
        <h1 className="font-serif text-2xl text-ink">Who&apos;s handed something in</h1>
        <p className="mt-1 text-sm text-muted">Ungraded -- this tracks completion, not quality. Open a candidate to read their answers.</p>
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
                const answeredCount = orderedSections.filter((s) => answeredSet.has(`${t.id}:${s.id}`)).length;
                return (
                  <tr key={t.id} className="border-b border-border-faint last:border-none hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/portfolio/${t.id}/pre-course-task`} className="text-ink hover:text-primary">
                        {t.full_name}
                      </Link>
                    </td>
                    {orderedSections.map((s) => {
                      const answered = answeredSet.has(`${t.id}:${s.id}`);
                      return (
                        <td key={s.id} className="px-0.5 py-2.5 text-center">
                          <span
                            title={answered ? "Answered" : "Not answered yet"}
                            className={`inline-flex h-[22px] w-[26px] items-center justify-center rounded-[5px] text-xs font-medium ${
                              answered ? "status-pill status-pill-on-track" : "border border-dashed border-border-faint text-muted"
                            }`}
                          >
                            {answered ? "✓" : "--"}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-center text-xs font-medium text-muted">
                      {answeredCount} of {orderedSections.length}
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

      {/* connect-withdrawal-precourse-scope-spec-2026-08-21.md item 1: the
          tutor aggregate view, additive to the completion table above.
          Every section here is free text (pre_course_task_sections has no
          task-type/answer-key column), so there's no correct/incorrect to
          score against -- this is the "read-aloud-friendly summary" branch
          for every section, not the design's worked example of a scored
          sentence-correction task, which would need structured response
          data this schema doesn't have. */}
      {orderedSections.length > 0 && (trainees ?? []).length > 0 ? (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-serif text-lg text-ink">What the cohort said</h2>
            <p className="mt-1 text-sm text-muted">Skim, not scored -- every answer is free text. Open a section to read them.</p>
          </div>
          {orderedSections.map((s) => {
            const sectionResponses = (responses ?? [])
              .filter((r) => r.section_id === s.id && r.response && r.response.trim() !== "")
              .map((r) => ({ traineeId: r.trainee_id, text: r.response as string }))
              .sort((a, b) => (nameById.get(a.traineeId) ?? "").localeCompare(nameById.get(b.traineeId) ?? ""));
            return (
              <details key={s.id} className="sheet">
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-ink">
                    {s.source === "cambridge" ? "C" : "S"}
                    {s.sequence_index} · {s.title}
                  </span>
                  <span className="text-xs text-muted">
                    {sectionResponses.length} of {(trainees ?? []).length} answered
                  </span>
                </summary>
                <div className="mt-3 flex flex-col divide-y divide-border-faint">
                  {sectionResponses.length === 0 ? (
                    <p className="py-2 text-sm text-muted first:pt-2">Nobody has answered this yet.</p>
                  ) : (
                    sectionResponses.map((r) => (
                      <div key={r.traineeId} className="flex flex-col gap-1 py-3 first:pt-2">
                        <p className="text-xs font-medium text-muted">{nameById.get(r.traineeId) ?? "Unknown"}</p>
                        <p className="whitespace-pre-wrap text-sm text-ink">{r.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </details>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
