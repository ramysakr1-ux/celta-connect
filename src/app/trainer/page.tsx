import Link from "next/link";
import { redirect } from "next/navigation";
import { Link2, ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { CELTA_CRITERIA_CODES, computeTrajectory } from "@/lib/celta-criteria";
import { TrajectoryBarCompact } from "@/components/trajectory-gradient-bar";

// §10 -- the trainer/admin home. Was previously a dead link (every portfolio
// page's "Command Centre" header link pointed at /trainer with no page.tsx
// behind it -- a real 404, not a placeholder). The roster reuses
// computeTrajectory() for the "Standing" column exactly as the CELTA5
// trainer page already does (same function, same "trainer-only, estimated"
// caveat) rather than inventing a second grading signal.
export default async function TrainerHomePage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");

  const supabase = assessorCourseId ? createAdminClient() : await createClient();

  // §Area 2 of checkpoint 1 -- the shell consolidation moved this page's
  // header out of trainer/layout.tsx (which now wraps the (hub) shell's own
  // single header instead) and in here, since the bare /trainer landing is
  // the one place under this route that still needs its own wordmark bar.
  const header = (
    <div className="border-b border-border bg-card">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/trainer" className="block">
          <Wordmark size="sm" />
        </Link>
        {session?.profile ? (
          <span className="text-sm text-muted">{session.profile.full_name ?? session.email}</span>
        ) : null}
      </div>
    </div>
  );

  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return (
      <>
        {header}
        <div className="container py-8">
          <div className="sheet text-sm text-muted">No course assigned.</div>
        </div>
      </>
    );
  }

  const [{ data: course }, { data: trainees }] = await Promise.all([
    supabase.from("courses").select("name, start_date, end_date, total_hours").eq("id", courseId).maybeSingle(),
    supabase.from("profiles").select("id, full_name").eq("course_id", courseId).eq("role", "trainee").order("full_name"),
  ]);

  const traineeIds = (trainees ?? []).map((t) => t.id);
  const [{ data: lessons }, { data: matrixRows }] =
    traineeIds.length > 0
      ? await Promise.all([
          supabase.from("tp_lessons").select("trainee_id, length_minutes").eq("course_id", courseId),
          supabase.from("celta5_matrix").select("trainee_id, criteria_code, tutor_status_stage2").eq("course_id", courseId),
        ])
      : [{ data: [] }, { data: [] }];

  const cohortLine = [course?.name, course ? `${course.start_date} – ${course.end_date}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {header}
      <div className="container flex flex-col gap-10 py-8">
      {/* §10 hero -- same shape as the public landing hero (§2), now with
          its own wordmark bar above (see `header` const) since the shell
          consolidation removed trainer/layout.tsx's shared one. Placeholder
          copy per the plan's explicit "don't let wording block the build"
          instruction. */}
      <div className="pt-4">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
          {cohortLine || "Cambridge CELTA"}
          {assessorCourseId ? " · viewing as assessor (read-only)" : ""}
        </p>
        <h1 className="mt-2 max-w-2xl font-serif text-5xl font-medium leading-[1.1] text-ink">
          Every candidate gets one link. Everything they need lives behind it.
        </h1>
        <p className="mt-4 max-w-[700px] text-base leading-6 text-muted">
          Each trainee holds a unique workspace URL. It opens their course stream,
          resource hub, teaching practice record, written assignments and their personal CELTA 5
          -- and nobody else&apos;s.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-ink">Candidate roster</h3>
          <p className="text-xs text-muted">{(trainees ?? []).length} candidates · click a card to open a portfolio</p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {trainees && trainees.length > 0 ? (
            trainees.map((trainee) => {
              const traineeLessons = (lessons ?? []).filter((l) => l.trainee_id === trainee.id);
              const assessedHrs = traineeLessons.reduce((sum, l) => sum + (l.length_minutes ?? 0), 0) / 60;

              const traineeMatrix = (matrixRows ?? []).filter((m) => m.trainee_id === trainee.id);
              const matrixByCode = new Map(traineeMatrix.map((m) => [m.criteria_code, m.tutor_status_stage2]));
              const achievedCount = traineeMatrix.filter((m) => m.tutor_status_stage2 === "S+" || m.tutor_status_stage2 === "S").length;
              const criteriaPct = Math.round((achievedCount / CELTA_CRITERIA_CODES.length) * 100);

              const trajectory = computeTrajectory(CELTA_CRITERIA_CODES.map((code) => matrixByCode.get(code) ?? null));

              return (
                <Link
                  key={trainee.id}
                  href={`/portfolio/${trainee.id}`}
                  className="sheet group flex items-start justify-between gap-4 p-5 transition-colors hover:border-primary/40"
                >
                  <div>
                    <h4 className="font-serif text-lg text-ink">{trainee.full_name}</h4>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <Link2 className="size-3.5" aria-hidden="true" />
                      Portfolio
                    </p>
                    <p className={`mt-1.5 text-sm ${assessedHrs < 6 ? "text-status-warning-text" : "text-muted"}`}>
                      {assessedHrs.toFixed(2)} hrs assessed teaching · {criteriaPct}% criteria
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-3">
                    <TrajectoryBarCompact value={trajectory} />
                    <span className="text-muted transition-transform group-hover:translate-x-0.5">&rarr;</span>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="sheet text-sm text-muted">No trainees on this course yet.</p>
          )}
        </div>
      </div>

      {/* Landing stays a clean first look -- the operational tools
          (roster table, timetable, volunteers, TP rotation, TP points
          library, grades report) all live one click in, at the Command
          Centre, not on this page. sheet-accent, not a full saturated
          primary bar -- same pale teal wash used elsewhere, the heading
          text + ShieldCheck icon (same icon ViewSwitcherPill uses for this
          exact "Command Centre" destination) carry the identity instead of
          a solid block of colour. Whole row is one Link, arrow-only
          affordance, same as each candidate card above -- no second button
          repeating the heading text. */}
      <Link
        href="/trainer/roster"
        className="sheet-accent group flex items-center justify-between gap-4 p-5 transition-colors hover:border-primary/40"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-serif text-lg text-ink">Trainer Command Centre</h3>
            <p className="mt-1 text-sm text-muted">
              Full roster, TP assessment, assignment grading and CELTA 5 editing for all{" "}
              {(trainees ?? []).length} candidate{(trainees ?? []).length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>
        <span className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5">&rarr;</span>
      </Link>
      </div>
    </>
  );
}
