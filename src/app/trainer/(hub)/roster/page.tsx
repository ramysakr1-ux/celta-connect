import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { fetchRosterRows } from "@/lib/roster";
import { RosterRowView } from "@/app/trainer/(hub)/roster/roster-row";
import { AddCandidateButton } from "@/app/trainer/(hub)/roster/add-candidate-button";

// The detailed operational roster. Row computation lives in lib/roster.ts,
// shared with the CSV export route below so the two can't drift on what a
// column means.
export default async function TrainerRosterPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");

  const supabase = assessorCourseId ? createAdminClient() : await createClient();

  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }

  const rows = await fetchRosterRows(supabase, courseId);

  // Assessors reuse this same page (createAdminClient path) but have no
  // reason to invite anyone -- only render the join-link button for a real
  // trainer/admin session.
  let joinUrl: string | null = null;
  if (trainer) {
    const { data: course } = await supabase.from("courses").select("trainee_join_token").eq("id", courseId).maybeSingle();
    const siteUrl = process.env.SITE_URL;
    joinUrl = siteUrl && course?.trainee_join_token ? `${siteUrl}/join/${course.trainee_join_token}` : null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Roster</p>
          <h1 className="font-serif text-2xl text-ink">{rows.length} candidates</h1>
        </div>
        <div className="flex items-center gap-5">
          <p className="text-xs text-muted">Click a row to open a portfolio</p>
          <a
            href="/trainer/pre-course-task"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Pre-course tasks →
          </a>
          <a
            href="/trainer/roster/export"
            className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary"
          >
            Export CSV
          </a>
          {trainer ? <AddCandidateButton courseId={courseId} joinUrl={joinUrl} /> : null}
        </div>
      </div>

      <div className="sheet overflow-hidden !p-0">
        <table className="table-plain w-full">
          <thead>
            <tr>
              <th className="text-sm text-muted">Candidate</th>
              <th className="text-right text-sm text-muted">Assessed hrs</th>
              <th className="text-right text-sm text-muted">TPs passed</th>
              <th className="text-right text-sm text-muted">Assignments left</th>
              <th className="text-right text-sm text-muted">Criteria</th>
              <th className="text-right text-sm text-muted">Attendance</th>
              <th className="text-right text-sm text-muted">Standing</th>
              <th className="text-right text-sm text-muted">Provisional</th>
              <th className="text-right text-sm text-muted">At risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => <RosterRowView key={row.id} row={row} />)
            ) : (
              <tr>
                <td colSpan={9} className="text-muted">
                  No trainees on this course yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
