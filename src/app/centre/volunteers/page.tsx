import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can, canView } from "@/lib/auth/centre-permissions";
import { computeSessionTicks } from "@/lib/volunteer-attendance";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { VolunteerPoolRow } from "@/app/centre/volunteer-pool-row";

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
  if (!canView(ctx.roles, "volunteers.view")) redirect("/centre");

  const { branch } = await searchParams;
  const mine = ctx.availableCenterIds;
  const scope = branch && mine.includes(branch) ? [branch] : mine;

  const admin = createAdminClient();
  const { data: courses } = await admin.from("courses").select("id, name, center_id").in("center_id", scope);
  const courseIds = (courses ?? []).map((c) => c.id);
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));

  const { data: volunteers } =
    courseIds.length > 0
      ? await admin.from("volunteer_students").select("id, course_id, name, level, volunteer_person_id").in("course_id", courseIds)
      : { data: [] };

  const volunteerIds = (volunteers ?? []).map((v) => v.id);
  const [{ data: tpEvents }, { data: attendanceRows }] = await Promise.all([
    courseIds.length > 0
      ? admin.from("course_timetable_events").select("id, event_date, course_id").in("course_id", courseIds).eq("type", "tp")
      : Promise.resolve({ data: [] }),
    volunteerIds.length > 0
      ? admin.from("volunteer_attendance").select("volunteer_student_id, timetable_event_id").in("volunteer_student_id", volunteerIds)
      : Promise.resolve({ data: [] }),
  ]);

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
      return { ...g, hours };
    })
    .sort((a, b) => b.hours - a.hours);

  const canEdit = can(ctx.roles, "centre.settings.edit");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Centre overview &middot; volunteers</p>
          <h1 className="font-serif text-2xl text-ink">Volunteer pool</h1>
        </div>
        <Link href="/centre" className="text-sm font-semibold text-muted hover:text-ink">
          ← Overview
        </Link>
      </div>

      <div className="rounded-[10px] border border-border bg-card">
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
                members={g.members.map((m) => ({ id: m.id, courseName: courseNameById.get(m.courseId) ?? "Unknown course", level: m.level }))}
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
  );
}
