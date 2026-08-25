import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can, canView } from "@/lib/auth/centre-permissions";
import { computeSessionTicks } from "@/lib/volunteer-attendance";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { VolunteerPoolRow } from "@/app/centre/volunteer-pool-row";
import { Wordmark } from "@/components/wordmark";
import { toLocalIso } from "@/lib/timetable-grid";

// Dedicated screen per Volunteer Pool.dc.html (Desktop/Connect.zip handoff,
// 2026-08-20): "reached from the 'Volunteer pool' card on the Centre Admin
// overview" -- browsing/merging every volunteer across the centre is its
// own destination, not just a card on Overview. Same person-grouping query
// and row component as the Overview card (centre/page.tsx); this page adds
// nothing new to the data model, just a full, unbounded, dedicated list
// instead of the Overview card's capped-height summary.
export default async function CentreVolunteersPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length === 0) redirect("/dashboard");
  if (!canView(ctx.roles, "volunteers.view", ctx.overrides)) redirect("/centre");

  const { branch } = await searchParams;
  const mine = ctx.availableCenterIds;
  const scope = branch && mine.includes(branch) ? [branch] : mine;

  const admin = createAdminClient();
  const { data: courses } = await admin.from("courses").select("id, name, center_id, end_date").in("center_id", scope);
  const courseIds = (courses ?? []).map((c) => c.id);
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));
  const courseEndById = new Map((courses ?? []).map((c) => [c.id, c.end_date]));
  const today = toLocalIso(new Date());

  const { data: volunteers } =
    courseIds.length > 0
      ? await admin.from("volunteer_students").select("id, course_id, name, level, volunteer_person_id").in("course_id", courseIds)
      : { data: [] };

  const volunteerIds = (volunteers ?? []).map((v) => v.id);
  const [{ data: tpEvents }, { data: attendanceRows }, { data: declineRows }] = await Promise.all([
    courseIds.length > 0
      ? admin.from("course_timetable_events").select("id, event_date, course_id").in("course_id", courseIds).eq("type", "tp")
      : Promise.resolve({ data: [] }),
    volunteerIds.length > 0
      ? admin.from("volunteer_attendance").select("volunteer_student_id, timetable_event_id").in("volunteer_student_id", volunteerIds)
      : Promise.resolve({ data: [] }),
    volunteerIds.length > 0
      ? admin.from("volunteer_declines").select("volunteer_student_id, timetable_event_id").in("volunteer_student_id", volunteerIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Ramy, 25 Aug 2026: "for the center, the names will be attached as well"
  // -- unlike the trainer/trainee aggregate-only counts, the centre roster
  // is already a per-person list, so "who's coming to the next class"
  // shows right on that person's own row rather than as a separate summary.
  const nextTpEventIdByCourse = new Map<string, string>();
  for (const e of tpEvents ?? []) {
    if (e.event_date < today) continue;
    const current = nextTpEventIdByCourse.get(e.course_id);
    const currentDate = current ? (tpEvents ?? []).find((x) => x.id === current)?.event_date : undefined;
    if (!current || (currentDate && e.event_date < currentDate)) nextTpEventIdByCourse.set(e.course_id, e.id);
  }
  const declinedKeys = new Set((declineRows ?? []).map((d) => `${d.volunteer_student_id}:${d.timetable_event_id}`));

  const groups = new Map<
    string,
    { name: string; members: { id: string; courseId: string; level: string | null }[]; personId: string | null }
  >();
  for (const v of volunteers ?? []) {
    const key = v.volunteer_person_id ?? v.id;
    const existing = groups.get(key);
    const member = { id: v.id, courseId: v.course_id, level: v.level };
    if (existing) existing.members.push(member);
    else groups.set(key, { name: v.name, members: [member], personId: v.volunteer_person_id });
  }
  const volunteerGroups = [...groups.values()]
    .map((g) => {
      const ids = g.members.map((m) => m.id);
      const attendedEventIds = new Set(
        (attendanceRows ?? []).filter((a) => ids.includes(a.volunteer_student_id)).map((a) => a.timetable_event_id)
      );
      const sessions = computeSessionTicks(tpEvents ?? [], attendedEventIds, TP_LESSON_LENGTH_MINUTES);
      const hours = sessions.reduce((sum, s) => sum + s.creditedMinutes, 0) / 60;
      // for-claude-code-volunteer-pool-header.md: "sage green for active
      // volunteers, muted grey once a volunteer's course has ended" -- a
      // volunteer linked across several courses reads as active as long as
      // at least one of them hasn't ended yet.
      const active = g.members.some((m) => {
        const end = courseEndById.get(m.courseId);
        return !end || end >= today;
      });
      return { ...g, hours, active };
    })
    .sort((a, b) => b.hours - a.hours);

  const canEdit = can(ctx.roles, "centre.settings.edit", ctx.overrides);

  return (
    <div className="volunteer-surface -m-6 flex flex-col">
      {/* for-claude-code-volunteer-pool-header.md: a dedicated sage/coral
          header, same full-bleed break-out (-m-6 cancelling the shared
          centre/layout.tsx frame's own p-6) as /centre/owner's dark header
          -- the shared Centre Admin header/tabs above stay exactly as they
          are; this is this one page's own band, not a layout-wide change. */}
      <div className="volunteer-header flex h-[60px] shrink-0 items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <Wordmark size="header" onDark tileBg="color-mix(in oklab, oklch(97% 0.008 88) 22%, transparent)" />
          <span className="h-4 w-px" style={{ background: "color-mix(in oklab, oklch(97% 0.008 88) 25%, transparent)" }} aria-hidden="true" />
          <span
            className="rounded-[5px] px-2.5 py-1 text-[11px] font-bold tracking-[0.1em] uppercase"
            style={{
              color: "oklch(97% 0.008 88)",
              background: "color-mix(in oklab, oklch(97% 0.008 88) 14%, transparent)",
              border: "1px solid color-mix(in oklab, oklch(97% 0.008 88) 30%, transparent)",
            }}
          >
            Centre Management
          </span>
        </div>
        <Link href="/centre" className="text-[12.5px] font-semibold no-underline" style={{ color: "oklch(97% 0.008 88)", opacity: 0.8 }}>
          ← Overview
        </Link>
      </div>

      <div className="flex flex-col gap-5 p-8">
        <div className="flex flex-col gap-[3px]">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Centre overview &middot; volunteers</p>
          <h1 className="font-serif text-2xl text-ink">Volunteer pool</h1>
        </div>

        <div className="card rounded-[9px] border-t-[var(--vol-sage)]">
          <div className="flex items-baseline justify-between border-b border-border px-5 py-4">
            <h2 className="font-serif text-base text-ink">
              {volunteerGroups.length} {volunteerGroups.length === 1 ? "person" : "people"}
            </h2>
            <span className="text-xs text-muted">{(volunteers ?? []).length} registrations across the centre</span>
          </div>
          {volunteerGroups.length === 0 ? (
            <p className="px-5 py-3 text-xs text-muted">Nobody registered yet.</p>
          ) : (
            <div className="flex flex-col">
              {volunteerGroups.map((g) => (
                <VolunteerPoolRow
                  key={g.members[0].id}
                  name={g.name}
                  hours={g.hours}
                  active={g.active}
                  members={g.members.map((m) => {
                    const nextEventId = nextTpEventIdByCourse.get(m.courseId);
                    const nextClassStatus: "coming" | "declined" | null = !nextEventId
                      ? null
                      : declinedKeys.has(`${m.id}:${nextEventId}`)
                        ? "declined"
                        : "coming";
                    return { id: m.id, courseName: courseNameById.get(m.courseId) ?? "Unknown course", level: m.level, nextClassStatus };
                  })}
                  canEdit={canEdit}
                  linkOptions={volunteerGroups
                    .filter((o) => o.members[0].id !== g.members[0].id)
                    .map((o) => ({ id: o.members[0].id, name: o.name }))}
                />
              ))}
            </div>
          )}
          <p className="border-t border-border-faint px-5 py-2.5 text-[11px] leading-[1.5] text-muted">
            Linked automatically when a signup&apos;s email matches one already on file; otherwise link them
            yourself above -- never guessed from name alone. Hours accumulate across every course a
            volunteer&apos;s linked records span.
          </p>
        </div>
      </div>

      <style>{`
        .volunteer-surface {
          --vol-sage: oklch(35% 0.075 155);
          --vol-coral: oklch(58% 0.14 25);
        }
        .volunteer-header { background: var(--vol-sage); border-bottom: 3px solid var(--vol-coral); }
      `}</style>
    </div>
  );
}
