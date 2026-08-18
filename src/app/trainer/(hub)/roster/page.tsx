import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { fetchRosterRows } from "@/lib/roster";
import { RosterRowView } from "@/app/trainer/(hub)/roster/roster-row";
import { AddCandidateButton } from "@/app/trainer/(hub)/roster/add-candidate-button";
import { AssessorLinkButton } from "@/app/trainer/assessor-link-button";

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
            href="/trainer/observation-tasks"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Observation tasks →
          </a>
          <a
            href="/trainer/gtky"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Day-one activities →
          </a>
          <a
            href="/trainer/roster/export"
            className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary"
          >
            Export CSV
          </a>
          {trainer ? (
            <Link
              href="/trainer/connect-hub"
              className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary"
            >
              {trainer.connect_hub_link ? "Connect Hub" : "Set up Connect Hub"}
            </Link>
          ) : null}
          {trainer ? <AssessorLinkButton /> : null}
          {/* The overnight session moved ViewSwitcherPill here out of the
              header; Ramy then confirmed (2026-08-16, against design-files.md
              and the remaining-screens spec) that the switcher is retired
              outright, not relocated -- "no global toggle anymore". Candidate
              preview is a per-candidate "Preview as trainee" button on the
              Portfolio screen, and the volunteers register has its own nav
              tab, so both of its live segments now have real homes. */}
          {trainer ? <AddCandidateButton courseId={courseId} joinUrl={joinUrl} /> : null}
        </div>
      </div>

      <div className="sheet overflow-x-auto !p-0">
        <table className="table-plain w-full">
          <thead>
            <tr>
              <th className="text-sm text-muted">Candidate</th>
              <th className="text-right text-sm text-muted">Assessed hrs</th>
              <th className="text-right text-sm text-muted">TPs passed</th>
              <th className="text-right text-sm text-muted">Assignments</th>
              <th className="text-right text-sm text-muted">Criteria</th>
              <th className="text-right text-sm text-muted">Attendance</th>
              <th className="text-right text-sm text-muted">TP stages</th>
              <th className="text-right text-sm text-muted">Supervised review</th>
              <th className="text-right text-sm text-muted">Observation hrs</th>
              <th className="text-right text-sm text-muted">Stage 1 report</th>
              <th className="text-right text-sm text-muted">Stage 2 / 3</th>
              <th className="text-right text-sm text-muted">CELTA 5 sign-off</th>
              <th className="text-right text-sm text-muted">FOL logged</th>
              <th className="text-right text-sm text-muted">Standing</th>
              <th className="text-right text-sm text-muted">Provisional</th>
              <th className="text-right text-sm text-muted">Obs. tasks</th>
              <th className="text-right text-sm text-muted">At risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => <RosterRowView key={row.id} row={row} />)
            ) : (
              <tr>
                <td colSpan={17} className="text-muted">
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
