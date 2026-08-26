import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { computeWeekOf, computeCourseState } from "@/lib/course-progress";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getRecentCentreChanges } from "@/lib/what-changed";
import { WhatChangedPanel } from "@/components/what-changed-panel";
import { LaptopOnlyGate } from "@/components/laptop-only-gate";
import { computeApplicantCounts } from "@/lib/admissions-counts";
import { computeEntryFormDeadline } from "@/lib/entry-form-deadline";
import { getCachedCenter } from "@/lib/supabase/cached-queries";

// for-claude-code-course-admin-landing-and-admissions.md §1: date-derived
// "upcoming" alone doesn't tell Course Admin what's actually next for a
// course -- still filling seats, or done with admissions and just
// waiting for the start date. Split by accepting_applications (the same
// flag the /apply intake dropdown reads) into two groups with different
// jobs: Interviewing now needs pipeline attention; Launching soon needs
// the entry form. Running is deliberately de-emphasized -- it's the
// MCT's day-to-day now, not Course Admin's. Closed collapses to one link
// rather than a full list, since there's nothing left to do with any of
// them individually from here.
type LandingGroup = "interviewing" | "launching" | "running";
const GROUP_LABEL: Record<LandingGroup, string> = {
  interviewing: "Interviewing now",
  launching: "Launching soon",
  running: "Running",
};
const GROUP_ORDER: LandingGroup[] = ["interviewing", "launching", "running"];
const GROUP_PILL_CLASS: Record<LandingGroup, string> = {
  interviewing: "status-pill bg-primary/10 text-primary",
  launching: "status-pill bg-primary/10 text-primary",
  running: "status-pill bg-surface-muted text-muted",
};
const ENTRY_FORM_WARNING_WINDOW_DAYS = 14;

export default async function AdminDashboardPage() {
  const profile = await requireRole("admin");
  const supabase = await createClient();

  const [{ data: courses }, center, { data: people }, { data: events }] = await Promise.all([
    supabase.from("courses").select("*").eq("center_id", profile.center_id).order("start_date", { ascending: false }),
    getCachedCenter(profile.center_id),
    supabase.from("profiles").select("course_id, role").eq("center_id", profile.center_id).not("course_id", "is", null),
    supabase.from("course_timetable_events").select("course_id, event_date"),
  ]);
  const today = toLocalIso(new Date(), center?.time_zone ?? DEFAULT_TIMEZONE);

  const courseIds = (courses ?? []).map((c) => c.id);
  const { data: applicants } = courseIds.length
    ? await supabase.from("applicants").select("intake_course_id, stage, special_requirements").in("intake_course_id", courseIds)
    : { data: [] };

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
    { label: "TP points library", count: tpPoints.count ?? 0, suffix: "points", href: "/dashboard/admin/coursebooks" },
    { label: "Assignment briefs", count: briefs.count ?? 0, suffix: "", href: "/dashboard/admin/assignment-briefs" },
    { label: "Resource hub", count: resources.count ?? 0, suffix: "items", href: "/trainer/resource-hub" },
    { label: "Feedback style examples", count: styleExamples.count ?? 0, suffix: "", href: "/dashboard/admin/settings#feedback-style" },
    { label: "Coursebooks", count: coursebooks.count ?? 0, suffix: "", href: "/dashboard/admin/coursebooks" },
  ];

  const recentChanges = await getRecentCentreChanges(profile.center_id);

  const eventDatesByCourse = new Map<string, string[]>();
  for (const e of events ?? []) {
    const list = eventDatesByCourse.get(e.course_id) ?? [];
    list.push(e.event_date);
    eventDatesByCourse.set(e.course_id, list);
  }

  const closedCourses = (courses ?? []).filter((c) => computeCourseState(c.start_date, c.end_date, today) === "closed");

  const groups = GROUP_ORDER.map((group) => {
    const groupCourses = (courses ?? [])
      .filter((course) => {
        const state = computeCourseState(course.start_date, course.end_date, today);
        if (group === "running") return state === "running";
        if (state !== "upcoming") return false;
        return group === "interviewing" ? course.accepting_applications : !course.accepting_applications;
      })
      .map((course) => {
        const tutors = (people ?? []).filter((p) => p.course_id === course.id && (p.role === "trainer" || p.role === "admin")).length;
        const candidates = (people ?? []).filter((p) => p.course_id === course.id && p.role === "trainee").length;
        const hasEvents = (eventDatesByCourse.get(course.id) ?? []).length > 0;

        let progress: string;
        if (group === "running") {
          progress = computeWeekOf(course.start_date, course.end_date, today).replace(/^w/, "W");
        } else {
          progress = course.timetable_locked_at ? "Timetable locked" : hasEvents ? "Timetable draft" : "Not set up";
        }

        const applicantRows = (applicants ?? []).filter((a) => a.intake_course_id === course.id);
        const counts = group === "interviewing" ? computeApplicantCounts(applicantRows) : null;

        let entryFormLabel: { text: string; overdue: boolean } | null = null;
        if (group === "launching" && !course.entry_form_sent_at) {
          const deadline = computeEntryFormDeadline(course.start_date, course.delivery_mode);
          const daysOut = Math.ceil((new Date(`${deadline}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
          if (daysOut <= ENTRY_FORM_WARNING_WINDOW_DAYS) {
            entryFormLabel = daysOut <= 0 ? { text: "Entry form overdue", overdue: true } : { text: `Entry form due in ${daysOut}d`, overdue: false };
          }
        }

        return {
          course,
          people: tutors + candidates > 0 ? `${candidates} candidates · ${tutors} tutors` : "No one yet",
          progress,
          counts,
          entryFormLabel,
        };
      });

    return { group, courses: groupCourses };
  }).filter((g) => g.courses.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Corrected 2026-08-20: a persistent AdminTabs nav was added here on
          2026-08-15 after Admissions/TP Points Library/Settings had no way
          back except the browser button -- but checked against the actual
          design (Course Admin (standalone).html) that nav never matched it;
          1a's header is just "Connect" + the "COURSE ADMIN" pill. Removed --
          see the Centre material panel below for the real entry points, and
          the "Settings" link beside it, so nothing is a dead end again. */}
      {/* for-claude-code-course-admin.md, screen 1a: "Title: centre name +
          Cambridge centre number", with "New course" as the primary action.
          It used to read "Welcome, <name>", which tells the person something
          they already know and omits the two facts that print on every report. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* The design's own hierarchy, which I had inverted: the centre and
            its Cambridge number are the EYEBROW, and the page's title is
            "Courses" -- because that is what the screen is. Putting the centre
            name in the H1 made every admin screen look like the same page with
            a different list under it. */}
        <div className="flex flex-col gap-[5px]">
          <p className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">
            {center?.name ?? "Your centre"}
            {center?.center_number ? ` · Centre ${center.center_number}` : ""}
          </p>
          <h1 className="font-serif text-[24px] font-semibold text-ink">Courses</h1>
        </div>
        {/* The create form already lives in the sidebar, so this jumps to it
            rather than pointing at a /courses/new route that does not exist --
            a primary button that 404s is worse than no button. */}
        <Link
          href="/dashboard/admin/courses/new"
          className="flex h-[34px] shrink-0 items-center rounded-[6px] bg-primary px-[15px] text-[13px] font-semibold whitespace-nowrap text-primary-foreground"
        >
          New course
        </Link>
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
        /* The design's confirmation banner: warm-ink 9% fill, a 30% border, a
           6px dot, and the two lines stacked rather than run together. */
        <div className="flex items-start gap-[11px] rounded-[6px] border border-[color-mix(in_oklab,oklch(30%_0.042_58)_30%,transparent)] bg-[color-mix(in_oklab,oklch(30%_0.042_58)_9%,var(--color-card))] px-[15px] py-[13px]">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[oklch(30%_0.042_58)]" />
          <div className="flex flex-col gap-[3px]">
            <p className="text-[13px] font-semibold text-ink">Centre number set — {center.center_number}</p>
            <p className="text-xs leading-relaxed text-muted">Prints on every final report and cover sheet.</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          {groups.length > 0 || closedCourses.length > 0 ? (
            <>
              {groups.map((group) => (
                <div key={group.group} className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2.5">
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{GROUP_LABEL[group.group]}</p>
                    <p className="text-xs text-muted">
                      {group.courses.length} course{group.courses.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className={`card overflow-hidden !p-0 ${group.group === "running" ? "opacity-80" : ""}`}>
                    {group.courses.map((row) => (
                      <Link
                        key={row.course.id}
                        href={`/dashboard/admin/courses/${row.course.id}`}
                        className="flex items-center justify-between gap-4 border-b border-border-faint px-5 py-3.5 transition-colors duration-150 last:border-none hover:bg-[color-mix(in_oklab,var(--color-primary)_30%,var(--color-card))]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{row.course.name}</p>
                          <p className="mt-0.5 text-xs text-muted">
                            {row.course.start_date} &rarr; {row.course.end_date}
                          </p>
                        </div>
                        {row.counts ? (
                          <span className="hidden shrink-0 text-xs text-muted sm:inline">
                            {row.counts.accepted} accepted
                            {row.counts.flagged > 0 ? ` · ${row.counts.flagged} flagged` : ""} · {row.counts.pending} pending
                          </span>
                        ) : (
                          <span className="hidden shrink-0 text-xs text-muted sm:inline">{row.people}</span>
                        )}
                        {row.entryFormLabel ? (
                          <span className={`hidden shrink-0 text-xs sm:inline ${row.entryFormLabel.overdue ? "font-semibold text-destructive" : "text-status-warning-text"}`}>
                            {row.entryFormLabel.text}
                          </span>
                        ) : (
                          <span className="hidden shrink-0 text-xs text-muted sm:inline">{row.progress}</span>
                        )}
                        {group.group === "running" ? (
                          <span className="hidden shrink-0 text-xs text-muted sm:inline">Nothing needed from you</span>
                        ) : null}
                        <span className={GROUP_PILL_CLASS[group.group]}>{GROUP_LABEL[group.group]}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {closedCourses.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Closed</p>
                  <Link
                    href="/dashboard/admin/courses/closed"
                    className="card flex items-center justify-between gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--color-primary)_30%,var(--color-card))]"
                  >
                    <span className="text-sm text-ink">
                      {closedCourses.length} closed course{closedCourses.length === 1 ? "" : "s"}
                    </span>
                    <span className="text-xs font-medium text-primary">View history &rarr;</span>
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-muted">No courses yet.</p>
          )}
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
              <Link
                key={m.label}
                href={m.href}
                className="-mx-2 flex items-center justify-between gap-3 border-b border-border-faint px-2 py-2 transition-colors duration-150 last:border-none hover:bg-[color-mix(in_oklab,var(--color-primary)_30%,var(--color-card))]"
              >
                <span className="text-xs text-ink">{m.label}</span>
                <span className="text-xs tabular-nums text-muted">
                  {m.count}
                  {m.suffix ? ` ${m.suffix}` : ""}
                </span>
              </Link>
            ))}
          </div>
          {/* Corrected 2026-08-20: the real design (Course Admin (standalone).html,
              screen 1a) has no persistent top tab bar at all -- just "Connect" +
              the "COURSE ADMIN" pill. "Centre material sits beside the courses,
              so it reads as the shared shell rather than a link in the header."
              This panel's own rows are the real entry points now, per that note
              -- and Settings needs a way in too, since nothing else here reaches it. */}
          <Link href="/dashboard/admin/settings" className="text-xs font-medium text-primary hover:underline">
            Settings →
          </Link>
        </div>

        <WhatChangedPanel changes={recentChanges} />
        </div>
        </LaptopOnlyGate>
      </div>

      {/* Course Administrator Landing.dc.html: "give a course a starting
          set of material before the MCT even logs in." Two tiles, not the
          mockup's three -- Ramy confirmed 2026-08-23 dropping the third
          ("Duplicate from a previous course") on purpose: TP points and
          assignment briefs are one shared set per centre (no course_id on
          either table), so there's nothing to duplicate between courses.
          DuplicateCourseForm already covers the one thing that IS real
          per-course material (Resource Hub files) as part of duplicating
          the whole course -- see its own copy ("Your centre-wide TP
          Points Library and assignment briefs are already shared
          automatically, nothing to copy there"). */}
      <LaptopOnlyGate task="Course material">
        <div className="card flex flex-col gap-3 border-t-[3px] border-t-primary p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-lg text-ink">Course material</h2>
            <span className="rounded-[5px] bg-primary/10 px-2 py-0.5 text-[10.5px] font-bold tracking-[0.08em] text-primary uppercase">
              Optional head start
            </span>
          </div>
          <p className="max-w-[700px] text-sm text-muted">
            Give any course a starting set of assignment briefs, TP points, and coursebooks from the centre&apos;s
            shared library -- before the MCT even logs in.
          </p>
          <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/dashboard/admin/coursebooks"
              className="flex flex-col gap-1.5 rounded-[7px] border border-border p-3.5 transition-colors duration-150 hover:border-primary hover:bg-[color-mix(in_oklab,var(--color-primary)_30%,var(--color-card))]"
            >
              <span className="text-[12.5px] font-semibold text-ink">Build from the shared library</span>
              <span className="text-[11px] leading-relaxed text-muted">
                Browse the centre&apos;s TP points, briefs, resources, and coursebooks.
              </span>
              <span className="mt-1 text-[11.5px] font-medium text-primary">Open library &rarr;</span>
            </Link>
            <div className="flex flex-col gap-1.5 rounded-[7px] border border-border p-3.5">
              <span className="text-[12.5px] font-semibold text-ink">Leave for the MCT</span>
              <span className="text-[11px] leading-relaxed text-muted">
                The default. The MCT sets material up themselves once the course begins.
              </span>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted">
            Want a head start closer to a specific past course? Use &quot;Duplicate this course&quot; from that
            course&apos;s own page -- it copies the timetable and any course-specific Resource Hub files. TP points
            and assignment briefs are already shared centre-wide, so there&apos;s nothing to duplicate there.
          </p>
        </div>
      </LaptopOnlyGate>
    </div>
  );
}
