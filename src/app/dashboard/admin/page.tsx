import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { CreateCourseForm } from "@/app/dashboard/admin/create-course-form";
import { computeWeekOf, computeCourseState, type CourseState } from "@/lib/course-progress";
import { toLocalIso } from "@/lib/timetable-grid";
import { getRecentCentreChanges } from "@/lib/what-changed";
import { WhatChangedPanel } from "@/components/what-changed-panel";
import { LaptopOnlyGate } from "@/components/laptop-only-gate";
import { DesignerCredit } from "@/components/designer-credit";

// Centre Admin.dc.html 1a -- courses group by state instead of a flat
// date-sorted list. State is purely date-derived (see computeCourseState's
// comment): Close-out (build-spec item 20) isn't built yet, so "closed"
// here just means the end date has passed, not that a real export/erase
// happened -- the progress text below must stay honest about that.
const STATE_LABEL: Record<CourseState, string> = { running: "Running", upcoming: "Upcoming", closed: "Closed" };
const STATE_ORDER: CourseState[] = ["running", "upcoming", "closed"];
const STATE_PILL_CLASS: Record<CourseState, string> = {
  running: "status-pill status-pill-on-track",
  upcoming: "status-pill bg-primary/10 text-primary",
  closed: "status-pill bg-surface-muted text-muted",
};

export default async function AdminDashboardPage() {
  const profile = await requireRole("admin");
  const supabase = await createClient();
  const today = toLocalIso(new Date());

  const [{ data: courses }, { data: center }, { data: people }, { data: events }] = await Promise.all([
    supabase.from("courses").select("*").eq("center_id", profile.center_id).order("start_date", { ascending: false }),
    supabase.from("centers").select("name, center_number").eq("id", profile.center_id).maybeSingle(),
    supabase.from("profiles").select("course_id, role").eq("center_id", profile.center_id).not("course_id", "is", null),
    supabase.from("course_timetable_events").select("course_id, event_date"),
  ]);

  // Centre material -- shared by every course at this centre, built once
  // and carried forward (mirrors the design's own framing: "the centre
  // owns the shell, the course owns the people").
  const [tpPoints, briefs, resources, styleExamples, coursebooks] = await Promise.all([
    supabase.from("tp_points").select("id", { count: "exact", head: true }).eq("center_id", profile.center_id),
    supabase.from("assignment_templates").select("id", { count: "exact", head: true }).eq("center_id", profile.center_id),
    supabase.from("resources").select("id", { count: "exact", head: true }).eq("center_id", profile.center_id),
    supabase.from("feedback_style_examples").select("id", { count: "exact", head: true }).eq("center_id", profile.center_id),
    supabase.from("tp_coursebooks").select("id", { count: "exact", head: true }).eq("center_id", profile.center_id),
  ]);

  const centreMaterial = [
    { label: "TP points library", count: tpPoints.count ?? 0, suffix: "points" },
    { label: "Assignment briefs", count: briefs.count ?? 0, suffix: "" },
    { label: "Resource hub", count: resources.count ?? 0, suffix: "items" },
    { label: "Feedback style examples", count: styleExamples.count ?? 0, suffix: "" },
    { label: "Coursebooks", count: coursebooks.count ?? 0, suffix: "" },
  ];

  const recentChanges = await getRecentCentreChanges(profile.center_id);

  const eventDatesByCourse = new Map<string, string[]>();
  for (const e of events ?? []) {
    const list = eventDatesByCourse.get(e.course_id) ?? [];
    list.push(e.event_date);
    eventDatesByCourse.set(e.course_id, list);
  }

  const groups = STATE_ORDER.map((state) => {
    const stateCourses = (courses ?? [])
      .map((course) => {
        const tutors = (people ?? []).filter((p) => p.course_id === course.id && (p.role === "trainer" || p.role === "admin")).length;
        const candidates = (people ?? []).filter((p) => p.course_id === course.id && p.role === "trainee").length;
        const hasEvents = (eventDatesByCourse.get(course.id) ?? []).length > 0;

        let progress: string;
        if (state === "running") {
          progress = computeWeekOf(course.start_date, course.end_date, today).replace(/^w/, "W");
        } else if (state === "upcoming") {
          progress = course.timetable_locked_at ? "Timetable locked" : hasEvents ? "Timetable draft" : "Not set up";
        } else {
          progress = `Ended ${course.end_date}`;
        }

        return {
          course,
          people: tutors + candidates > 0 ? `${candidates} candidates · ${tutors} tutors` : "No one yet",
          progress,
        };
      })
      .filter((row) => computeCourseState(row.course.start_date, row.course.end_date, today) === state);

    return { state, courses: stateCourses };
  }).filter((g) => g.courses.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Admissions/TP Points Library/Settings used to live only here --
          moved to a persistent AdminTabs nav in dashboard/layout.tsx so they
          don't disappear the moment you click into one (Ramy, live-testing
          2026-08-15: no way back except the browser's own back button). */}
      {/* for-claude-code-course-admin.md, screen 1a: "Title: centre name +
          Cambridge centre number", with "New course" as the primary action.
          It used to read "Welcome, <name>", which tells the person something
          they already know and omits the two facts that print on every report. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Connect · course admin</p>
          <h1 className="mt-1 font-serif text-[26px] text-ink">
            {center?.name ?? "Your centre"}
            {center?.center_number ? <span className="text-muted"> · Centre {center.center_number}</span> : null}
          </h1>
        </div>
        {/* The create form already lives in the sidebar, so this jumps to it
            rather than pointing at a /courses/new route that does not exist --
            a primary button that 404s is worse than no button. */}
        <a
          href="#new-course"
          className="shrink-0 rounded-[6px] bg-ink-warm px-4 py-2 text-sm font-semibold text-card"
        >
          New course
        </a>
      </div>

      {center?.center_number.startsWith("PENDING-") ? (
        <div className="flex items-start gap-3 rounded-[6px] border border-destructive/30 bg-destructive/5 p-4">
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-destructive" />
          <div>
            <p className="text-sm font-semibold text-ink">Your centre number is still a placeholder -- {center.center_number}</p>
            <p className="mt-0.5 text-sm text-muted">
              It prints on every final report and cover sheet.{" "}
              <Link href="/dashboard/admin/settings" className="text-primary hover:underline">
                Set the real Cambridge number
              </Link>{" "}
              before any report is released.
            </p>
          </div>
        </div>
      ) : center?.center_number ? (
        <div className="flex items-center gap-3 rounded-[6px] border border-border bg-card p-3">
          <span className="size-1.5 shrink-0 rounded-full bg-primary" />
          <p className="text-sm text-ink">
            Centre number set -- {center.center_number}
            <span className="text-muted"> &middot; Prints on every final report and cover sheet.</span>
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          {/* The design labels the list, so the state groups read as
              subdivisions of one thing rather than three separate lists. */}
          <h2 className="font-serif text-lg text-ink">Courses</h2>
          {groups.length > 0 ? (
            groups.map((group) => (
              <div key={group.state} className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2.5">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{STATE_LABEL[group.state]}</p>
                  <p className="text-xs text-muted">
                    {group.courses.length} course{group.courses.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="card overflow-hidden !p-0">
                  {group.courses.map((row) => (
                    <Link
                      key={row.course.id}
                      href={`/dashboard/admin/courses/${row.course.id}`}
                      className="flex items-center justify-between gap-4 border-b border-border-faint px-5 py-3.5 last:border-none hover:bg-surface-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{row.course.name}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {row.course.start_date} &rarr; {row.course.end_date}
                        </p>
                      </div>
                      <span className="hidden shrink-0 text-xs text-muted sm:inline">{row.people}</span>
                      <span className="hidden shrink-0 text-xs text-muted sm:inline">{row.progress}</span>
                      <span className={STATE_PILL_CLASS[group.state]}>{STATE_LABEL[group.state]}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted">No courses yet.</p>
          )}

          <div id="new-course">
            <CreateCourseForm centerNumber={center?.center_number ?? null} />
          </div>
        </div>

        {/* specs/build-spec.md §7: admin gets "status plus the one or two
            decisions only they can make" on a phone -- the course list and
            Create course above are exactly that. These two panels are pure
            browsing/informational (counts, a recent-activity feed), not a
            decision or the centre's live status, so they're the one part
            of this page that's laptop-only. */}
        <LaptopOnlyGate task="Centre material and recent activity">
        <div className="flex flex-col gap-6">
        <div className="card flex flex-col gap-3 p-5">
          <div>
            <h2 className="font-serif text-base text-ink">Centre material</h2>
            <p className="mt-0.5 text-xs text-muted">Shared by every course at this centre. Built once, carried forward.</p>
          </div>
          <div className="flex flex-col">
            {centreMaterial.map((m) => (
              <div key={m.label} className="flex items-center justify-between gap-3 border-b border-border-faint py-2 last:border-none">
                <span className="text-xs text-ink">{m.label}</span>
                <span className="text-xs tabular-nums text-muted">
                  {m.count}
                  {m.suffix ? ` ${m.suffix}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        <WhatChangedPanel changes={recentChanges} />
        </div>
        </LaptopOnlyGate>
      </div>

      <DesignerCredit />
    </div>
  );
}
