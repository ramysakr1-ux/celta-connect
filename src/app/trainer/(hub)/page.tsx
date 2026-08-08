import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { fetchRosterRows } from "@/lib/roster";
import { categorize, isEventLive, toLocalIso } from "@/lib/timetable-grid";
import { CATEGORY_ACCENT } from "@/app/trainer/(hub)/timetable/event-cell";
import { computeWeekOf } from "@/lib/course-progress";

// Checkpoint 2 -- Today, the (hub) group's own index page (bare /trainer),
// replacing the old marketing hero + candidate-card-grid. build-spec.md's
// App Redesign.dc.html 1a: today's schedule (from the real timetable),
// what needs a trainer's attention right now, and the cohort at a glance.
export default async function TodayPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");
  // Today is trainer-only operational material (write actions, cohort-wide
  // alerts) -- assessors stay on the roster, same boundary trainer-tabs.tsx
  // already draws for everything except Grades Report.
  if (assessorCourseId && !trainer) redirect("/trainer/roster");

  const supabase = await createClient();
  const courseId = trainer!.course_id;
  if (!courseId) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }

  const today = toLocalIso(new Date());

  const rows = await fetchRosterRows(supabase, courseId);
  const nameById = new Map(rows.map((r) => [r.id, r.name]));
  const traineeIds = rows.map((r) => r.id);

  const [{ data: course }, { data: todayEvents }, { data: lessons }, { data: feedbackRows }, { data: dueAssignments }] =
    await Promise.all([
      supabase.from("courses").select("name, start_date, end_date").eq("id", courseId).maybeSingle(),
      supabase
        .from("course_timetable_events")
        .select("*")
        .eq("course_id", courseId)
        .eq("event_date", today)
        .order("event_time"),
      supabase.from("tp_lessons").select("trainee_id, lesson_date, tp_number").eq("course_id", courseId).not("lesson_date", "is", null),
      // tp_feedback has no course_id column -- scope by this course's trainee ids instead.
      traineeIds.length > 0
        ? supabase.from("tp_feedback").select("trainee_id, tp_number, submitted_at").in("trainee_id", traineeIds)
        : Promise.resolve({ data: [] }),
      supabase.from("assignments").select("assignment_type, first_submitted_at").eq("course_id", courseId).eq("due_date", today),
    ]);

  // "Needs you" -- capped at 3 total, this priority order.
  type Alert = { title: string; meta: string; href: string; destructive?: boolean };
  const alerts: Alert[] = [];

  const unsentByTrainee = new Map<string, string>(); // trainee_id -> most recent taught date
  for (const lesson of lessons ?? []) {
    const hasFeedback = (feedbackRows ?? []).some(
      (f) => f.trainee_id === lesson.trainee_id && f.tp_number === lesson.tp_number && f.submitted_at
    );
    if (!hasFeedback && lesson.lesson_date) {
      const existing = unsentByTrainee.get(lesson.trainee_id);
      if (!existing || lesson.lesson_date > existing) unsentByTrainee.set(lesson.trainee_id, lesson.lesson_date);
    }
  }
  if (unsentByTrainee.size > 0) {
    const names = [...unsentByTrainee.keys()].map((id) => nameById.get(id) ?? "Unknown");
    const latestDate = [...unsentByTrainee.values()].sort().at(-1);
    alerts.push({
      title: `TP feedback unsent — ${unsentByTrainee.size} candidate${unsentByTrainee.size === 1 ? "" : "s"}`,
      meta: `${names.join(", ")} · taught ${latestDate}`,
      href: "/trainer/roster",
    });
  }

  const dueByType = new Map<string, { total: number; submitted: number }>();
  for (const a of dueAssignments ?? []) {
    const entry = dueByType.get(a.assignment_type) ?? { total: 0, submitted: 0 };
    entry.total += 1;
    if (a.first_submitted_at) entry.submitted += 1;
    dueByType.set(a.assignment_type, entry);
  }
  for (const [type, { total, submitted }] of dueByType) {
    alerts.push({ title: `${type} due today`, meta: `${submitted} of ${total} submitted`, href: "/trainer/roster" });
  }

  const atRisk = rows.filter((r) => r.attendancePct < 80);
  for (const r of atRisk) {
    alerts.push({
      title: `Attendance below 80% — ${r.name}`,
      meta: `${r.attendancePct}%`,
      href: `/portfolio/${r.id}`,
      destructive: true,
    });
  }

  const visibleAlerts = alerts.slice(0, 3);

  const cohort = rows.slice(0, 6);
  const barColor = (r: (typeof rows)[number]) =>
    r.trajectory === "Pass A"
      ? "var(--color-gold)"
      : r.trajectory === "Fail"
        ? "var(--color-destructive)"
        : "var(--color-primary)";

  const weekOf =
    course?.start_date && course?.end_date ? computeWeekOf(course.start_date, course.end_date, today) : null;

  const overline = [course?.name, course ? `${course.start_date} – ${course.end_date}` : null, weekOf].filter(Boolean).join(" · ");
  const todayHeading = new Date(`${today}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{overline}</p>
          <h1 className="font-serif text-3xl text-ink">{todayHeading}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/trainer/timetable"
            className="rounded-[6px] border border-border bg-card px-3.5 py-2 text-sm font-medium text-ink hover:border-primary"
          >
            Add event
          </Link>
          <Link
            href="/trainer/roster"
            className="rounded-[6px] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Record TP feedback
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr_1.1fr]">
        {/* Today's schedule */}
        <div className="sheet flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Today&apos;s schedule</p>
            <p className="text-[11px] text-muted">from the timetable</p>
          </div>
          <div className="flex flex-col">
            {(todayEvents ?? []).length === 0 ? (
              <p className="py-2 text-sm text-muted">Nothing on the timetable today.</p>
            ) : (
              (todayEvents ?? []).map((event, i) => {
                const category = categorize(event);
                const live = event.type === "tp" && isEventLive(event, new Date());
                return (
                  <div
                    key={event.id}
                    className={`flex gap-3.5 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}
                  >
                    <span
                      className="w-11 shrink-0 border-l-[3px] pl-2 text-xs font-semibold text-muted tabular-nums"
                      style={{ borderLeftColor: CATEGORY_ACCENT[category] }}
                    >
                      {event.event_time?.slice(0, 5)}
                    </span>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <p className="text-sm text-ink">{event.title}</p>
                      {live ? (
                        <a
                          href={event.zoom_url ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary-foreground"
                        >
                          <span className="size-[5px] shrink-0 rounded-full bg-gold" />
                          Join now
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Needs you */}
        <div className="sheet flex flex-col gap-3.5">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">Needs you · {alerts.length}</p>
          <div className="flex flex-col">
            {visibleAlerts.length === 0 ? (
              <p className="py-2 text-sm text-muted">Nothing needs you right now.</p>
            ) : (
              visibleAlerts.map((alert, i) => (
                <Link
                  key={i}
                  href={alert.href}
                  className={`flex flex-col gap-0.5 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}
                >
                  <p className={`text-sm font-semibold ${alert.destructive ? "text-destructive" : "text-ink"}`}>{alert.title}</p>
                  <p className="text-xs text-muted">{alert.meta}</p>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Cohort */}
        <div className="sheet flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Cohort · {rows.length}</p>
            <Link href="/trainer/roster" className="text-[11px] text-primary">
              Full roster →
            </Link>
          </div>
          <div className="flex flex-col">
            {cohort.map((r, i) => (
              <Link
                key={r.id}
                href={`/portfolio/${r.id}`}
                className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}
              >
                <span className="flex-1 truncate text-sm text-ink">{r.name}</span>
                <span className="text-xs text-muted tabular-nums">{r.tpsPassed} / 8</span>
                <span className="h-1 w-[54px] shrink-0 overflow-hidden rounded-full bg-surface-muted">
                  <span
                    className="block h-1 rounded-full"
                    style={{ width: `${r.criteriaPct}%`, backgroundColor: barColor(r) }}
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
