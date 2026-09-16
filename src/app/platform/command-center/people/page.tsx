import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { computeSessionTicks } from "@/lib/volunteer-attendance";
import { classLessons } from "@/lib/volunteer-class-session";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { ChangeRoleForm } from "@/app/platform/platform-forms";

// Ramy, 25 Aug 2026, rejecting the first build of this page (a flat name-
// by-name roster): "this is a command center for all my projects, not for
// a CELTA course... I don't want the details of the everyday activities.
// I just care about... a percentage, how many trainees." Rebuilt as
// per-course aggregate rows -- counts and a real volunteer-attendance
// rate, nothing name-level. The detailed roster this replaced already
// exists at the course's own /trainer/roster for whoever actually runs
// that course day to day.
//
// Migrated onto the shared .card design system 27 Aug 2026 -- was hand-built
// inline styles (CARD/TEAL/GOLD/RED literals) copied straight from
// command-center-visual-reference.html. The KPI row previously carried one
// hardcoded teal left-border on every tile, then a decorative teal/garnet
// alternation; since the centre side's A1 (16 Sep 2026) the tiles are plain
// cards -- a figure carries no edge. The per-course Status pill reuses
// the same Running/Ended/Upcoming semantics -- and colors -- as
// src/app/centre/page.tsx's courseState() (teal/grey/gold), via the shared
// .status-pill component this time instead of a hand-rolled color-mix.
export default async function CommandCenterPeoplePage() {
  const profile = await requireRole("platform_owner");
  const admin = createAdminClient();

  const [{ data: ownerRoles }, { data: invites }, { data: centers }] = await Promise.all([
    admin.from("centre_roles").select("center_id").eq("profile_id", profile.id).eq("role", "centre_owner").is("revoked_at", null),
    admin.from("platform_owner_invites").select("center_id").is("revoked_at", null),
    admin.from("centers").select("id, name, time_zone"),
  ]);
  const accessibleCenterIds = [...new Set([...(ownerRoles ?? []).map((r) => r.center_id), ...(invites ?? []).map((i) => i.center_id)])];
  const centerNameById = new Map((centers ?? []).map((c) => [c.id, c.name]));
  // Ramy, 28 Aug 2026: "the timezone changed" -- same fix as the Overview
  // page. Each centre's own local date, not the server's UTC date.
  const now = new Date();
  const todayByCenterId = new Map((centers ?? []).map((c) => [c.id, toLocalIso(now, c.time_zone ?? DEFAULT_TIMEZONE)]));
  const todayFor = (centerId: string | null | undefined) => todayByCenterId.get(centerId ?? "") ?? toLocalIso(now, DEFAULT_TIMEZONE);

  if (accessibleCenterIds.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="mb-2 font-serif text-h3 font-semibold text-ink">People, across your centres</h2>
        <p className="text-sm text-muted">You don&apos;t currently have Owner or Invited access to any centre.</p>
      </div>
    );
  }

  const { data: courseRows } = await admin
    .from("courses")
    .select("id")
    .in("center_id", accessibleCenterIds);
  const accessibleCourseIds = (courseRows ?? []).map((c) => c.id);

  const [{ data: courses }, { data: trainees }, { data: trainers }, { data: volunteers }, { data: tpEvents }, { data: attendance }] = await Promise.all([
    admin.from("courses").select("id, name, center_id, start_date, end_date").in("center_id", accessibleCenterIds).order("start_date", { ascending: false }),
    admin.from("profiles").select("course_id").eq("role", "trainee").in("center_id", accessibleCenterIds),
    admin.from("profiles").select("course_id").eq("role", "trainer").in("center_id", accessibleCenterIds),
    // Scoped to these centres' own courses. All three used to fetch the
    // whole table and filter in JS -- every volunteer, every TP row and
    // every attendance mark in the database, on each load.
    admin.from("volunteer_students").select("id, course_id, level").is("removed_at", null).in("course_id", accessibleCourseIds),
    admin.from("course_timetable_events").select("id, course_id, event_date, detail").eq("type", "tp").in("course_id", accessibleCourseIds),
    admin.from("volunteer_attendance").select("id, timetable_event_id"),
  ]);

  const coursesList = courses ?? [];
  const courseIds = new Set(coursesList.map((c) => c.id));
  const courseCenterById = new Map(coursesList.map((c) => [c.id, c.center_id]));

  function countBy<T extends { course_id: string | null }>(rows: T[] | null): Map<string, number> {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!r.course_id || !courseIds.has(r.course_id)) continue;
      m.set(r.course_id, (m.get(r.course_id) ?? 0) + 1);
    }
    return m;
  }

  const traineeCountByCourse = countBy(trainees);
  const trainerCountByCourse = countBy(trainers);
  const volunteerCountByCourse = countBy((volunteers ?? []).filter((v) => courseIds.has(v.course_id)));

  // Volunteer attendance, per session -- not per timetable row.
  //
  // This counted attendance marks against volunteers x TP EVENTS, and on a
  // two-group course a day is six events across two levels while a
  // volunteer sits through the three of their own class. So the
  // denominator was double and every rate read at half (walked 15 Sep
  // 2026). Same maths the register and the centre pool use: a session is
  // one class's day, present is round(2N/3) of its lessons.
  const attendedEventIds = new Set((attendance ?? []).map((a) => a.timetable_event_id));
  const sessionsByCourse = new Map<string, { held: number; attended: number }>();
  for (const v of volunteers ?? []) {
    if (!courseIds.has(v.course_id)) continue;
    const lessons = classLessons(
      (tpEvents ?? []).filter((e) => e.course_id === v.course_id && e.event_date <= todayFor(courseCenterById.get(v.course_id))),
      v.level
    );
    const ticks = computeSessionTicks(lessons, attendedEventIds, TP_LESSON_LENGTH_MINUTES);
    const row = sessionsByCourse.get(v.course_id) ?? { held: 0, attended: 0 };
    row.held += ticks.length;
    row.attended += ticks.filter((t) => t.ticked).length;
    sessionsByCourse.set(v.course_id, row);
  }

  const totalTrainees = [...traineeCountByCourse.values()].reduce((s, n) => s + n, 0);
  const totalTrainers = [...trainerCountByCourse.values()].reduce((s, n) => s + n, 0);
  const totalVolunteers = [...volunteerCountByCourse.values()].reduce((s, n) => s + n, 0);
  const runningCourses = coursesList.filter((c) => c.start_date <= todayFor(c.center_id) && c.end_date >= todayFor(c.center_id)).length;

  const kpis = [
    { label: "Courses running", value: runningCourses, sub: `${coursesList.length} total across your centres` },
    { label: "Trainees", value: totalTrainees, sub: "across every course" },
    { label: "Trainers", value: totalTrainers, sub: "MCT/ACT combined" },
    { label: "Volunteers", value: totalVolunteers, sub: "signed up" },
  ];

  return (
    <div className="flex flex-col gap-[22px]">
      {/* A10, 16 Sep 2026: this was a card on /platform, the platform owner's
          second home. Setting someone's account-level role is a People
          question, so it is on the People page. */}
      <div className="card flex flex-col gap-3.5 p-5">
        <div>
          <h2 className="font-serif text-h3 font-semibold text-ink">Change a user&apos;s role</h2>
          <p className="mt-1 text-sm text-muted">Looks someone up by email and sets their account-level role directly.</p>
        </div>
        <ChangeRoleForm />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {kpis.map((stat, i) => (
          <div key={stat.label} className={`card flex flex-col gap-1.5 px-[18px] py-4`}>
            <div className="text-micro font-bold uppercase tracking-[0.08em] text-muted">{stat.label}</div>
            <div className="font-serif text-h1 font-semibold text-ink tabular-nums">{stat.value}</div>
            <div className="text-label text-muted">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="card !p-0">
        <h2 className="px-5 pt-[18px] pb-1.5 font-serif text-h3 font-semibold text-ink">By course</h2>
        <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_1.2fr] border-b border-rule-gold">
          {["Centre / course", "Status", "Trainees", "Trainers", "Volunteer attendance"].map((h) => (
            <div key={h} className="px-5 py-4 text-micro font-bold uppercase tracking-wide text-muted">
              {h}
            </div>
          ))}
        </div>
        {/* One rule per ROW. Each cell used to draw its own border-b under an
            items-center row, so the taller cells (the status pill, the
            two-line centre/course name) put their borders lower than the
            plain number cells and the rule broke into segments -- the same
            bug as the Centres table on Overview. */}
        {coursesList.map((c) => {
          const courseToday = todayFor(c.center_id);
          const running = c.start_date <= courseToday && c.end_date >= courseToday;
          const ended = c.end_date < courseToday;
          const volunteerCount = volunteerCountByCourse.get(c.id) ?? 0;
          const sessions = sessionsByCourse.get(c.id) ?? { held: 0, attended: 0 };
          const sessionsSoFar = volunteerCount > 0 ? Math.round(sessions.held / volunteerCount) : 0;
          const attendancePct = sessions.held > 0 ? Math.round((sessions.attended / sessions.held) * 100) : null;
          return (
            <div
              key={c.id}
              className="hover-ring grid grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_1.2fr] items-center border-b border-rule-gold-soft last:border-b-0"
            >
              <div className="px-5 py-[13px] text-meta font-semibold text-ink">
                {centerNameById.get(c.center_id) ?? "Unknown centre"}
                <div className="text-label font-normal text-muted">{c.name}</div>
              </div>
              <div className="px-5 py-[13px]">
                <span className={`status-pill ${running ? "status-pill-on-track" : ended ? "bg-status-neutral-bg text-muted" : "status-pill-pending"}`}>
                  {running ? "Running" : ended ? "Ended" : "Upcoming"}
                </span>
              </div>
              <div className="px-5 py-[13px] text-meta tabular-nums text-ink">{traineeCountByCourse.get(c.id) ?? 0}</div>
              <div className="px-5 py-[13px] text-meta tabular-nums text-ink">{trainerCountByCourse.get(c.id) ?? 0}</div>
              <div className="px-5 py-[13px] text-meta text-ink">
                {volunteerCount === 0 ? (
                  <span className="text-muted">No volunteers</span>
                ) : attendancePct === null ? (
                  <span className="text-muted">No TP sessions yet</span>
                ) : (
                  <span className={`font-bold ${attendancePct < 60 ? "text-destructive" : attendancePct < 80 ? "text-status-warning-text" : "text-primary"}`}>
                    {attendancePct}%{" "}
                    <span className="font-normal text-muted">
                      ({volunteerCount} volunteers, {sessionsSoFar} sessions)
                    </span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {coursesList.length === 0 ? <p className="p-5 text-sm text-muted">No courses at your accessible centres yet.</p> : null}
      </div>
    </div>
  );
}
