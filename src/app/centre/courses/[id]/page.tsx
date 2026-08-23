import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { canView, can } from "@/lib/auth/centre-permissions";
import { computeWeekOf, computeCourseState } from "@/lib/course-progress";
import { toLocalIso } from "@/lib/timetable-grid";
import { tutorRoleLabel } from "@/lib/tutor-roles";
import { PricingForm } from "@/app/centre/courses/[id]/pricing-form";

const STATE_LABEL: Record<string, string> = { running: "Running", upcoming: "Upcoming", closed: "Closed" };

// for-claude-code-course-admin-final-scope.md: "A view-only drill-in to any
// one course, showing only: whether tutors have joined, who's the MCT, who's
// the ACT, how many trainees, general standing. Enough to know the course is
// healthy -- not enough to manage it." Pricing is the one write surface here
// (Capacity/pricing was cut from the wizard entirely and reassigned to
// Centre Admin, per the same spec) -- everything else on this page is read-only.
export default async function CentreCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  if (!canView(ctx.roles, "courseAdmin.view")) redirect("/centre");

  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select(
      "id, name, course_code, center_id, start_date, end_date, delivery_mode, cohort_size, fee_amount, deposit_amount, fee_currency, deposit_due_days"
    )
    .eq("id", id)
    .maybeSingle();
  if (!course || !ctx.availableCenterIds.includes(course.center_id)) notFound();

  const [{ data: tutorRows }, { count: traineeCount }] = await Promise.all([
    admin.from("course_tutors").select("profile_id, tutor_role, verified_at, left_at").eq("course_id", id).is("left_at", null),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("course_id", id).eq("role", "trainee"),
  ]);

  const tutorProfileIds = (tutorRows ?? []).map((t) => t.profile_id);
  const { data: tutorProfiles } = tutorProfileIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", tutorProfileIds)
    : { data: [] };
  const profileById = new Map((tutorProfiles ?? []).map((p) => [p.id, p]));
  const tutors = (tutorRows ?? []).map((t) => ({
    name: profileById.get(t.profile_id)?.full_name ?? "Unknown",
    email: profileById.get(t.profile_id)?.email ?? "",
    role: t.tutor_role,
    joined: Boolean(t.verified_at),
  }));

  const today = toLocalIso(new Date());
  const state = computeCourseState(course.start_date, course.end_date, today);
  const standing =
    state === "running"
      ? computeWeekOf(course.start_date, course.end_date, today).replace(/^w/, "W")
      : state === "upcoming"
        ? "Not started yet"
        : `Ended ${course.end_date}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/centre" className="text-sm text-muted hover:text-ink">
          &larr; All courses
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
              {[course.course_code, course.delivery_mode].filter(Boolean).join(" · ")}
            </p>
            <h1 className="mt-1 font-serif text-xl text-ink">{course.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {course.start_date} &rarr; {course.end_date}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-ink">
            {STATE_LABEL[state]} &middot; {standing}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-serif text-base text-ink">Tutors</h2>
          {tutors.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No tutors have joined yet.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {tutors.map((t) => (
                <div key={t.email} className="flex items-center justify-between gap-3 border-t border-border-faint pt-2 first:border-none first:pt-0">
                  <div>
                    <p className="text-sm text-ink">{t.name}</p>
                    <p className="text-xs text-muted">{t.email}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {tutorRoleLabel(t.role)}
                    {!t.joined ? " · invited" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-serif text-base text-ink">Cohort</h2>
          <p className="mt-2 text-sm text-ink">
            {traineeCount ?? 0} trainee{(traineeCount ?? 0) === 1 ? "" : "s"}
            {course.cohort_size ? ` of ${course.cohort_size} max` : ""}
          </p>
          <p className="mt-3 text-xs text-muted">
            This is a health check, not a management view -- roster, subgroups, and everything operational live
            inside the course itself, with the MCT.
          </p>
        </div>
      </div>

      {/* for-claude-code-course-admin-scope-reduction.md: "Capacity and
          pricing... belongs to Centre Admin, not Course Admin." The one
          write surface on this otherwise read-only page. */}
      {can(ctx.roles, "course.editRecord") ? (
        <PricingForm
          courseId={course.id}
          feeAmount={course.fee_amount}
          depositAmount={course.deposit_amount}
          feeCurrency={course.fee_currency}
          depositDueDays={course.deposit_due_days}
        />
      ) : null}
    </div>
  );
}
