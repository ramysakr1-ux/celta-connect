import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { Wordmark } from "@/components/wordmark";
import { PortfolioTabs } from "@/app/portfolio/[traineeId]/portfolio-tabs";
import { StatBar } from "@/app/portfolio/[traineeId]/stat-bar";

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

  const [{ data: course }, { data: center }, { data: lessons }, { data: celta5Record }, { data: assignments }] =
    await Promise.all([
      trainee.course_id
        ? supabase.from("courses").select("*").eq("id", trainee.course_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("centers").select("*").eq("id", trainee.center_id).maybeSingle(),
      supabase.from("tp_lessons").select("length_minutes").eq("trainee_id", trainee.id),
      supabase.from("celta5_records").select("hours_attended").eq("trainee_id", trainee.id).maybeSingle(),
      supabase.from("assignments").select("first_status, resubmission_status").eq("trainee_id", trainee.id),
    ]);

  const assessedHours = (lessons ?? []).reduce((sum, l) => sum + (l.length_minutes ?? 0), 0) / 60;
  const attendanceHours = celta5Record?.hours_attended ?? 0;
  const assignmentsPassed = (assignments ?? []).filter(
    (a) => a.first_status === "approved" || a.resubmission_status === "approved"
  ).length;

  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const isStaffView = isStaff || Boolean(assessorCourseId);
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
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-muted">
              <span className="font-serif text-xl text-muted">{initials}</span>
            </div>
            <h1 className="font-serif text-3xl leading-none text-ink">{trainee.full_name}</h1>
          </div>
          <p className="mt-0.5 ml-[68px] text-xs text-muted">
            {[course?.name, course ? `${course.start_date} – ${course.end_date}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-12">
          <StatBar label="Assessed teaching" value={Number(assessedHours.toFixed(2))} max={6} unit="hrs" />
          <StatBar
            label="Attendance"
            value={Number(attendanceHours.toFixed(1))}
            max={course?.total_hours ?? 120}
            unit="hrs"
          />
          <StatBar label="Assignments passed" value={assignmentsPassed} max={4} />
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
