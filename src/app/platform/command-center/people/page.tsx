import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

const CARD = "oklch(0.992 0.005 90)";
const INK = "oklch(0.235 0.017 65)";
const MUTED = "oklch(0.51 0.017 70)";
const BORDER = "oklch(0.895 0.012 82)";
const TEAL = "oklch(0.375 0.058 195)";
const GOLD = "oklch(0.63 0.096 72)";
const RED = "oklch(0.58 0.16 25)";

// Ramy, 25 Aug 2026, rejecting the first build of this page (a flat name-
// by-name roster): "this is a command center for all my projects, not for
// a CELTA course... I don't want the details of the everyday activities.
// I just care about... a percentage, how many trainees." Rebuilt as
// per-course aggregate rows -- counts and a real volunteer-attendance
// rate, nothing name-level. The detailed roster this replaced already
// exists at the course's own /trainer/roster for whoever actually runs
// that course day to day.
export default async function CommandCenterPeoplePage() {
  const profile = await requireRole("platform_owner");
  const admin = createAdminClient();

  const [{ data: ownerRoles }, { data: invites }, { data: centers }] = await Promise.all([
    admin.from("centre_roles").select("center_id").eq("profile_id", profile.id).eq("role", "centre_owner").is("revoked_at", null),
    admin.from("platform_owner_invites").select("center_id").is("revoked_at", null),
    admin.from("centers").select("id, name"),
  ]);
  const accessibleCenterIds = [...new Set([...(ownerRoles ?? []).map((r) => r.center_id), ...(invites ?? []).map((i) => i.center_id)])];
  const centerNameById = new Map((centers ?? []).map((c) => [c.id, c.name]));

  if (accessibleCenterIds.length === 0) {
    return (
      <div style={{ background: CARD, borderRadius: 10, boxShadow: "rgba(30,20,10,0.04) 0 1px 2px", padding: 20 }}>
        <div style={{ fontFamily: "Newsreader, serif", fontSize: 17, fontWeight: 600, color: INK, marginBottom: 8 }}>People, across your centres</div>
        <p style={{ fontSize: 13, color: MUTED }}>You don&apos;t currently have Owner or Invited access to any centre.</p>
      </div>
    );
  }

  const [{ data: courses }, { data: trainees }, { data: trainers }, { data: volunteers }, { data: tpEvents }, { data: attendance }] = await Promise.all([
    admin.from("courses").select("id, name, center_id, start_date, end_date").in("center_id", accessibleCenterIds).order("start_date", { ascending: false }),
    admin.from("profiles").select("course_id").eq("role", "trainee").in("center_id", accessibleCenterIds),
    admin.from("profiles").select("course_id").eq("role", "trainer").in("center_id", accessibleCenterIds),
    admin.from("volunteer_students").select("id, course_id").is("removed_at", null),
    admin.from("course_timetable_events").select("id, course_id, event_date").eq("type", "tp"),
    admin.from("volunteer_attendance").select("id, timetable_event_id, volunteer_students(course_id)"),
  ]);

  const coursesList = courses ?? [];
  const courseIds = new Set(coursesList.map((c) => c.id));
  const today = new Date().toISOString().slice(0, 10);

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

  const tpSessionsSoFarByCourse = new Map<string, number>();
  for (const e of tpEvents ?? []) {
    if (!courseIds.has(e.course_id) || e.event_date > today) continue;
    tpSessionsSoFarByCourse.set(e.course_id, (tpSessionsSoFarByCourse.get(e.course_id) ?? 0) + 1);
  }

  const eventCourseById = new Map((tpEvents ?? []).map((e) => [e.id, e.course_id]));
  const attendanceCountByCourse = new Map<string, number>();
  for (const a of attendance ?? []) {
    const courseId = eventCourseById.get(a.timetable_event_id);
    if (!courseId || !courseIds.has(courseId)) continue;
    attendanceCountByCourse.set(courseId, (attendanceCountByCourse.get(courseId) ?? 0) + 1);
  }

  const totalTrainees = [...traineeCountByCourse.values()].reduce((s, n) => s + n, 0);
  const totalTrainers = [...trainerCountByCourse.values()].reduce((s, n) => s + n, 0);
  const totalVolunteers = [...volunteerCountByCourse.values()].reduce((s, n) => s + n, 0);
  const runningCourses = coursesList.filter((c) => c.start_date <= today && c.end_date >= today).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Courses running", value: runningCourses, sub: `${coursesList.length} total across your centres` },
          { label: "Trainees", value: totalTrainees, sub: "across every course" },
          { label: "Trainers", value: totalTrainers, sub: "MCT/ACT combined" },
          { label: "Volunteers", value: totalVolunteers, sub: "signed up" },
        ].map((stat) => (
          <div key={stat.label} style={{ background: CARD, borderRadius: 8, borderLeft: `3px solid ${TEAL}`, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 5, boxShadow: "rgba(30,20,10,0.04) 0 1px 2px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>{stat.label}</div>
            <div style={{ fontFamily: "Newsreader, serif", fontSize: 26, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: CARD, borderRadius: 10, boxShadow: "rgba(30,20,10,0.04) 0 1px 2px", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 6px", fontFamily: "Newsreader, serif", fontSize: 17, fontWeight: 600, color: INK }}>By course</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.7fr 0.7fr 1.2fr" }}>
          {["Centre / course", "Status", "Trainees", "Trainers", "Volunteer attendance"].map((h) => (
            <div key={h} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: MUTED, padding: "12px 20px", borderBottom: `1px solid ${BORDER}` }}>
              {h}
            </div>
          ))}
        </div>
        {coursesList.map((c) => {
          const running = c.start_date <= today && c.end_date >= today;
          const ended = c.end_date < today;
          const volunteerCount = volunteerCountByCourse.get(c.id) ?? 0;
          const sessionsSoFar = tpSessionsSoFarByCourse.get(c.id) ?? 0;
          const attended = attendanceCountByCourse.get(c.id) ?? 0;
          const possible = volunteerCount * sessionsSoFar;
          const attendancePct = possible > 0 ? Math.round((attended / possible) * 100) : null;
          return (
            <div key={c.id} className="admin-hover" style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.7fr 0.7fr 1.2fr", alignItems: "center" }}>
              <div style={{ padding: "13px 20px", borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 600, color: INK }}>
                {centerNameById.get(c.center_id) ?? "Unknown centre"}
                <div style={{ fontSize: 11, fontWeight: 400, color: MUTED }}>{c.name}</div>
              </div>
              <div style={{ padding: "13px 20px", borderBottom: `1px solid ${BORDER}` }}>
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                    background: running ? `color-mix(in oklab, ${TEAL} 12%, ${CARD})` : ended ? `color-mix(in oklab, ${MUTED} 10%, ${CARD})` : `color-mix(in oklab, ${GOLD} 14%, ${CARD})`,
                    color: running ? TEAL : ended ? MUTED : "oklch(0.44 0.095 68)",
                  }}
                >
                  {running ? "Running" : ended ? "Ended" : "Upcoming"}
                </span>
              </div>
              <div style={{ padding: "13px 20px", borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: INK, fontVariantNumeric: "tabular-nums" }}>{traineeCountByCourse.get(c.id) ?? 0}</div>
              <div style={{ padding: "13px 20px", borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: INK, fontVariantNumeric: "tabular-nums" }}>{trainerCountByCourse.get(c.id) ?? 0}</div>
              <div style={{ padding: "13px 20px", borderBottom: `1px solid ${BORDER}`, fontSize: 13, color: INK }}>
                {volunteerCount === 0 ? (
                  <span style={{ color: MUTED }}>No volunteers</span>
                ) : attendancePct === null ? (
                  <span style={{ color: MUTED }}>No TP sessions yet</span>
                ) : (
                  <span style={{ fontWeight: 700, color: attendancePct < 60 ? RED : attendancePct < 80 ? "oklch(0.44 0.095 68)" : TEAL }}>
                    {attendancePct}% <span style={{ fontWeight: 400, color: MUTED }}>({volunteerCount} volunteers, {sessionsSoFar} sessions)</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {coursesList.length === 0 ? <p style={{ padding: 20, fontSize: 13, color: MUTED }}>No courses at your accessible centres yet.</p> : null}
      </div>
    </div>
  );
}
