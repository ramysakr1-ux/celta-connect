import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { Wordmark } from "@/components/wordmark";
import { PortfolioTabs } from "@/app/portfolio/[traineeId]/portfolio-tabs";
import { StatBar } from "@/app/portfolio/[traineeId]/stat-bar";
import { CELTA_CRITERIA_CODES, computeCriteriaSuggestion, computeTrajectory } from "@/lib/celta-criteria";

const TRAJECTORY_LABEL: Record<string, string> = {
  "Pass A": "On track for Pass A",
  "Pass B": "On track for Pass B",
  Pass: "On track for Pass",
  Fail: "Flagged -- currently below Pass",
  not_enough_data: "Not enough data yet",
};

const TRAJECTORY_PILL_CLASS: Record<string, string> = {
  "Pass A": "pill-success",
  "Pass B": "pill-success",
  Pass: "pill-success",
  Fail: "pill-danger",
  not_enough_data: "pill-neutral",
};

// §3 -- shared shell for every /portfolio/:traineeId/* tab. A trainee can
// only ever land on their own :traineeId (redirected home otherwise);
// trainers/admins can open any trainee's portfolio from the roster. The
// underlying trainee/course fetch below relies on existing RLS to enforce
// that a trainer/admin can only reach trainees in their own course/center --
// if RLS denies the row, `trainee` comes back null and we 404, so there's
// no separate authorization check to duplicate here.
// §11 -- an assessor (no real session, token cookie only) reaches this same
// shell read-only, scoped to their token's course_id -- RLS has no
// auth.uid() to key off for them at all, so their branch uses the admin
// client with that course_id as the explicit authorization check instead.
export default async function PortfolioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ traineeId: string }>;
}) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;

  if (viewer?.role === "trainee" && viewer.id !== traineeId) {
    redirect(`/portfolio/${viewer.id}`);
  }

  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) redirect("/login");

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", traineeId)
    .eq("role", "trainee")
    .maybeSingle();
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const isStaffView = isStaff || Boolean(assessorCourseId);

  const [{ data: course }, { data: center }, { data: lessons }, { data: celta5Record }, { data: assignments }] =
    await Promise.all([
      trainee.course_id
        ? supabase.from("courses").select("*").eq("id", trainee.course_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("centers").select("*").eq("id", trainee.center_id).maybeSingle(),
      supabase.from("tp_lessons").select("id, length_minutes").eq("trainee_id", trainee.id),
      supabase.from("celta5_records").select("hours_attended").eq("trainee_id", trainee.id).maybeSingle(),
      supabase.from("assignments").select("first_status, resubmission_status").eq("trainee_id", trainee.id),
    ]);

  const assessedHours = (lessons ?? []).reduce((sum, l) => sum + (l.length_minutes ?? 0), 0) / 60;
  const attendanceHours = celta5Record?.hours_attended ?? 0;
  const assignmentsPassed = (assignments ?? []).filter(
    (a) => a.first_status === "approved" || a.resubmission_status === "approved"
  ).length;

  // Trajectory: trainer/assessor-only informal estimate, computed the exact
  // same way the CELTA5 page does (tutor's Stage Two ratings, falling back
  // to the same TP-feedback-tag suggestion when a criterion isn't rated
  // yet) -- gated behind isStaffView so a trainee view never pays for or
  // sees this query at all.
  let trajectory: string | null = null;
  if (isStaffView) {
    const lessonIds = (lessons ?? []).map((l) => l.id);
    const [{ data: matrix }, { data: criteriaTags }] = await Promise.all([
      supabase.from("celta5_matrix").select("criteria_code, tutor_status_stage2").eq("trainee_id", trainee.id),
      lessonIds.length > 0
        ? supabase.from("tp_lesson_criteria_tags").select("*").in("tp_lesson_id", lessonIds).order("created_at")
        : Promise.resolve({ data: [] }),
    ]);

    const matrixByCode = new Map((matrix ?? []).map((m) => [m.criteria_code, m.tutor_status_stage2]));
    const tagsByCriteria = new Map<string, { tag_type: "strength" | "action_point"; created_at: string }[]>();
    for (const tag of criteriaTags ?? []) {
      const list = tagsByCriteria.get(tag.criteria_code) ?? [];
      list.push({ tag_type: tag.tag_type, created_at: tag.created_at });
      tagsByCriteria.set(tag.criteria_code, list);
    }
    const trajectoryInputs = CELTA_CRITERIA_CODES.map(
      (code) => matrixByCode.get(code) ?? computeCriteriaSuggestion(tagsByCriteria.get(code) ?? []) ?? null
    );
    trajectory = computeTrajectory(trajectoryInputs);
  }

  const initials = trainee.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between">
          <Link href={isStaffView ? "/trainer" : `/portfolio/${trainee.id}`} className="block">
            <Wordmark size="sm" />
            <p className="text-[10px] tracking-[0.1em] text-muted uppercase">
              Trainee Workspace{assessorCourseId ? " · read-only" : ""}
            </p>
          </Link>
          {isStaffView ? (
            <Link href="/trainer" className="text-sm font-semibold text-primary">
              Command Centre
            </Link>
          ) : null}
        </div>
      </div>

      <PortfolioTabs traineeId={trainee.id} />

      <div className="container flex-1 py-8">
        <div className="sheet flex flex-col gap-5 p-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-muted">
              <span className="font-serif text-lg text-muted">{initials}</span>
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-2xl leading-tight text-ink">{trainee.full_name}</h1>
              <p className="truncate text-sm text-muted">
                {[course?.name, course ? `${course.start_date} – ${course.end_date}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-5 lg:max-w-2xl lg:grid-cols-3">
            <StatBar label="Assessed teaching" value={Number(assessedHours.toFixed(2))} max={6} unit="hrs" />
            <StatBar
              label="Attendance"
              value={Number(attendanceHours.toFixed(1))}
              max={course?.total_hours ?? 120}
              unit="hrs"
            />
            <StatBar label="Assignments passed" value={assignmentsPassed} max={4} />
          </div>

          {isStaffView && trajectory ? (
            <div className="lg:ml-2">
              <span className={`pill ${TRAJECTORY_PILL_CLASS[trajectory] ?? "pill-neutral"}`}>
                {TRAJECTORY_LABEL[trajectory] ?? trajectory}
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-8">{children}</div>
      </div>

      <footer className="mt-auto py-8 text-center text-xs text-muted">
        {[center?.name, center ? `Cambridge CELTA (Centre ${center.center_number})` : null, `Workspace link ${trainee.id.slice(0, 8)}`]
          .filter(Boolean)
          .join(" · ")}
      </footer>
    </div>
  );
}
