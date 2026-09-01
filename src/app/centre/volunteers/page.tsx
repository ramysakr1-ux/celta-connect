import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can, canView } from "@/lib/auth/centre-permissions";
import { computeSessionTicks } from "@/lib/volunteer-attendance";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { VolunteerPoolRow } from "@/app/centre/volunteer-pool-row";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";

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
  // Ramy, 27 Aug 2026 (round 2): scopeCenters only needs `scope`, already
  // known -- it doesn't need `courses` first, so it ran alongside it rather
  // than waiting for it.
  const [{ data: courses }, scopeCenters] = await Promise.all([
    admin.from("courses").select("id, name, center_id, end_date").in("center_id", scope),
    Promise.all(scope.map((id) => getCachedCenter(id))),
  ]);
  const courseIds = (courses ?? []).map((c) => c.id);
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));
  const courseEndById = new Map((courses ?? []).map((c) => [c.id, c.end_date]));
  // This view can span several centres at once (a branch owner's "all
  // branches" scope) -- each course's own centre decides its "today".
  const centerIdByCourseId = new Map((courses ?? []).map((c) => [c.id, c.center_id]));
  const timezoneByCenterId = new Map(scopeCenters.filter((c) => c !== null).map((c) => [c.id, c.time_zone]));
  const todayByCourseId = new Map(
    courseIds.map((id) => {
      const centerId = centerIdByCourseId.get(id);
      const timeZone = (centerId ? timezoneByCenterId.get(centerId) : null) ?? DEFAULT_TIMEZONE;
      return [id, toLocalIso(new Date(), timeZone)];
    })
  );

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
  const fallbackToday = toLocalIso(new Date(), DEFAULT_TIMEZONE);
  for (const e of tpEvents ?? []) {
    if (e.event_date < (todayByCourseId.get(e.course_id) ?? fallbackToday)) continue;
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
        return !end || end >= (todayByCourseId.get(m.courseId) ?? fallbackToday);
      });
      return { ...g, hours, active };
    })
    .sort((a, b) => b.hours - a.hours);

  const canEdit = can(ctx.roles, "centre.settings.edit", ctx.overrides);

  return (
    <div className="flex flex-col">
      {/* This page used to carry its own full-bleed sage band, with a SECOND
        Connect mark reversed onto it and its own "Centre Management" pill --
        so the page showed the wordmark twice, and the copy on the band had a
        tinted tile.

        Both are now against the rules. Ramy, 1 Sep 2026: "Connect does not
        change... it stands on top above all... always the same everywhere."
        And the volunteer pool is a room like any other, so it wears its colour
        the way the others do -- a rule under the shared header, its accent on
        the active pill, its wash on hovers -- rather than a band of its own.

        Sage is kept: it was this room's colour before any of this and there is
        no reason to take it away. */}


      <div className="flex flex-col gap-5 p-8">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-[3px]">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Centre overview &middot; volunteers</p>
            <h1 className="font-serif text-2xl text-ink">Volunteer pool</h1>
          </div>
          {/* Bulk-adding volunteers is this room's job, not Centre
              Management's -- see the note on SpreadsheetImportSection. The
              importer moved here on 1 Sep 2026 and this is its only door,
              so it is gated on the same capability the page enforces. */}
          {can(ctx.roles, "volunteers.manage", ctx.overrides) ? (
            <Link href="/centre/volunteers/import" className="text-sm font-semibold text-primary hover:underline">
              Import from a spreadsheet &rarr;
            </Link>
          ) : null}
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

    </div>
  );
}
