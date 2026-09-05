import { hubReadClient } from "@/lib/supabase/hub-read";
import { requireRole } from "@/lib/auth/require-role";
import { ASSESSOR_MEETING_TITLE } from "@/lib/assessor-day";
import { createClient } from "@/lib/supabase/server";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { AnnouncementComposer } from "@/app/trainer/(hub)/announcements/composer";
import { ScheduledPanel, type ScheduledRowData } from "@/app/trainer/(hub)/announcements/scheduled-panel";

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

// for-claude-code-trainer-remaining-screens.md's Announcements screen --
// not a nav tab, reached from Today's "Post announcement" button. Fixes
// the rest of the known bug note along with the composer's relocation
// (already done, see broadcast-composer.tsx): the full Write/Scheduled/
// Posted experience the spec describes, not just a quick-post widget.
export default async function AnnouncementsPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }
  const courseId = trainer.course_id;
  const supabase = hubReadClient(trainer, courseId);
  const timeZone = (await getCachedCenter(trainer.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);

  const [{ data: course }, { data: upcomingEvents }, { data: broadcasts }, { count: traineeCount }, { count: trainerCount }] =
    await Promise.all([
      supabase.from("courses").select("assessor_visit_date").eq("id", courseId).maybeSingle(),
      supabase
        .from("course_timetable_events")
        .select("id, title, event_date, event_time")
        .eq("course_id", courseId)
        .gte("event_date", today)
        .order("event_date")
        .order("event_time")
        .limit(30),
      supabase
        .from("course_broadcasts")
        .select("*")
        .eq("course_id", courseId)
        .order("sent_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      // for-claude-code-announcements-list.md table D: "before sending, the
      // composer states who it reaches and how many."
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("role", "trainee"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("role", "trainer"),
    ]);

  // D2's "send to one TP group" option. Member count per group joins
  // through course_subgroups (a tp_group can be paired into two subgroups
  // or stand alone unpaired) -- same shape Rotation and the Stage 2 sheet
  // already read, not a new relationship.
  const [{ data: tpGroups }, { data: subgroups }] = await Promise.all([
    supabase.from("course_tp_groups").select("id, name").eq("course_id", courseId),
    supabase.from("course_subgroups").select("id, tp_group_id").eq("course_id", courseId),
  ]);

  // for-claude-code-mct-only-announcements.md: mirrors postBroadcast's own
  // gate (stream-actions.ts) exactly -- MCT (or admin) only, full stop,
  // now that a trainee's real-time TP-group chat pill covers the informal
  // day-to-day channel a non-MCT tutor used to reach for here.
  const isAdmin = trainer.role === "admin";
  let isMct = isAdmin;
  if (!isAdmin) {
    const { data: mct } = await supabase
      .from("course_tutors")
      .select("profile_id")
      .eq("course_id", courseId)
      .eq("tutor_role", "main_course_tutor")
      .is("left_at", null)
      .maybeSingle();
    isMct = !mct || mct.profile_id === trainer.id;
  }
  // Ramy, 5 Sep 2026: an ACT posts to their own group. "Own" = the group
  // course_tp_groups names them tutor of today.
  const { data: myGroupRows } = isMct
    ? { data: [] as { id: string }[] }
    : await supabase.from("course_tp_groups").select("id").eq("course_id", courseId).eq("tutor_profile_id", trainer.id);
  const myGroupIds = new Set((myGroupRows ?? []).map((g) => g.id));
  const canCompose = isMct || myGroupIds.size > 0;
  const subgroupIdsByTpGroup = new Map<string, string[]>();
  for (const s of subgroups ?? []) {
    if (!s.tp_group_id) continue;
    const list = subgroupIdsByTpGroup.get(s.tp_group_id) ?? [];
    list.push(s.id);
    subgroupIdsByTpGroup.set(s.tp_group_id, list);
  }
  const allSubgroupIds = (subgroups ?? []).map((s) => s.id);
  const { data: subgroupMembers } =
    allSubgroupIds.length > 0
      ? await supabase.from("course_subgroup_members").select("subgroup_id").in("subgroup_id", allSubgroupIds)
      : { data: [] };
  const memberCountBySubgroup = new Map<string, number>();
  for (const m of subgroupMembers ?? []) {
    memberCountBySubgroup.set(m.subgroup_id, (memberCountBySubgroup.get(m.subgroup_id) ?? 0) + 1);
  }
  const composerGroups = (tpGroups ?? [])
    .filter((g) => isMct || myGroupIds.has(g.id))
    .map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: (subgroupIdsByTpGroup.get(g.id) ?? []).reduce((sum, sid) => sum + (memberCountBySubgroup.get(sid) ?? 0), 0),
    }));
  const groupNameById = new Map((tpGroups ?? []).map((g) => [g.id, g.name]));

  const authorIds = [...new Set((broadcasts ?? []).map((b) => b.author_id))];
  const { data: authors } = authorIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", authorIds) : { data: [] };
  const authorNameById = new Map((authors ?? []).map((a) => [a.id, a.full_name]));

  // Was 0-2 days before the visit, which is too late to be a reminder --
  // Ramy, 30 Aug 2026, describing the assessor day: "it's been announced,
  // there's a countdown for it... and there's a reminder. So there's a whole
  // thing set around the assessor day." The template is offered as soon as a
  // visit is on the books, and prefills a scheduled announcement anchored to
  // the assessor meeting rather than one sent the moment it's written. It
  // still only prefills; nothing posts without the MCT pressing send.
  const showAssessorTemplate = Boolean(
    course?.assessor_visit_date && course.assessor_visit_date >= today
  );

  // The assessor meeting is what the template anchors to. It is normally in
  // `upcomingEvents` already, but that query is capped at 30, so a visit at
  // the end of a long course could fall off the end of it -- fetched
  // explicitly and merged rather than left to chance.
  const { data: assessorMeetingEvent } = course?.assessor_visit_date
    ? await supabase
        .from("course_timetable_events")
        .select("id, title, event_date, event_time")
        .eq("course_id", courseId)
        .eq("title", ASSESSOR_MEETING_TITLE)
        .maybeSingle()
    : { data: null };
  const composerEvents =
    assessorMeetingEvent && !(upcomingEvents ?? []).some((e) => e.id === assessorMeetingEvent.id)
      ? [...(upcomingEvents ?? []), assessorMeetingEvent]
      : (upcomingEvents ?? []);

  const scheduled = (broadcasts ?? []).filter((b) => !b.sent_at);
  const posted = (broadcasts ?? []).filter((b) => b.sent_at);

  const anchorEventIds = [...new Set(scheduled.map((b) => b.anchor_event_id).filter((id): id is string => !!id))];
  const { data: anchorEvents } =
    anchorEventIds.length > 0
      ? await supabase.from("course_timetable_events").select("id, title, event_date, event_time").in("id", anchorEventIds)
      : { data: [] };
  const anchorById = new Map((anchorEvents ?? []).map((e) => [e.id, e]));

  // Edit's own event picker needs every scheduled row's CURRENT anchor
  // selectable even if it's since dropped out of the "upcoming" window
  // (upcomingEvents only looks forward from today) -- union rather than
  // assuming upcomingEvents always covers it.
  const editPickerEvents = [...(upcomingEvents ?? []), ...(anchorEvents ?? []).filter((e) => !(upcomingEvents ?? []).some((u) => u.id === e.id))];

  const scheduledRows: ScheduledRowData[] = scheduled.map((b) => {
    const anchor = b.anchor_event_id ? anchorById.get(b.anchor_event_id) : null;
    const fireDate = anchor && b.anchor_offset_days !== null ? addDays(anchor.event_date, b.anchor_offset_days) : null;
    return {
      id: b.id,
      title: b.title,
      body: b.body,
      pinned: b.pinned,
      keepOnDuplicate: b.keep_on_duplicate,
      anchorEventId: b.anchor_event_id ?? "",
      anchorEventTitle: anchor?.title ?? "Unknown event",
      anchorOffsetDays: b.anchor_offset_days ?? 0,
      fireDate,
      heldAt: b.held_at,
      canManage: isMct || b.author_id === trainer.id,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">Today</p>
        <h1 className="font-serif text-[34px] leading-[1.08] font-semibold text-ink-warm">Announcements</h1>
        <p className="mt-1 text-sm text-muted">
          The only way to reach the whole cohort at once -- there&apos;s no cohort chat channel. Candidates see these on
          their home screen, above their to-do list.
        </p>
      </div>

      {/* Today's idiom: one shadowed spine (the composer), flat cards beside
          it, rows with a badge and a hover ring. Ramy, 5 Sep 2026, on the
          old three grey boxes: "still looks the same kind of bland paper." */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
        {canCompose ? (
          <AnnouncementComposer
            timetableEvents={composerEvents}
            showAssessorTemplate={showAssessorTemplate && isMct}
            assessorMeetingEventId={assessorMeetingEvent?.id ?? null}
            traineeCount={traineeCount ?? 0}
            trainerCount={trainerCount ?? 0}
            groups={composerGroups}
            cohortAllowed={isMct}
          />
        ) : (
          <div className="trainer-hover flex flex-col gap-2 overflow-hidden rounded-[14px] border border-border bg-frame pb-4">
            <div className="flex items-center justify-between gap-3 rounded-t-[13px] px-[18px] py-2.5 text-[oklch(96%_0.008_85)]" style={{ background: "var(--color-ink-warm)" }}>
              <h2 className="font-serif text-[20px] font-semibold">Write an announcement</h2>
            </div>
            <p className="px-[18px] text-sm text-muted">
              Whole-cohort announcements are sent by the main course tutor. You can post to a TP group once you are named
              its tutor on Rotation; until then, the chat pill reaches your candidates informally.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-5">
          <ScheduledPanel scheduled={scheduledRows} timetableEvents={editPickerEvents} canManage={canCompose} />

          <section className="trainer-hover flex flex-col overflow-hidden rounded-[14px] border border-border bg-frame">
            <div className="flex items-center justify-between gap-3 rounded-t-[13px] px-[18px] py-2.5 text-[oklch(96%_0.008_85)]" style={{ background: "var(--color-ink-warm)" }}>
              <h3 className="font-serif text-[20px] font-semibold">Posted</h3>
              <span className="text-[12.5px] text-gold">{posted.length === 0 ? "Nothing yet" : `${posted.length} sent`}</span>
            </div>
            <div className="flex flex-col px-2.5 pt-2 pb-2.5">
              {posted.map((b) => {
                const when = new Date(`${(b.sent_at ?? b.created_at).slice(0, 10)}T00:00:00`);
                return (
                  <div key={b.id} className="trainer-hover grid grid-cols-[40px_1fr] items-center gap-3.5 rounded-[10px] px-3 py-[10px]">
                    <span className="flex size-10 flex-col items-center justify-center rounded-[10px] bg-ink-warm text-primary-foreground">
                      <span className="text-[13px] leading-none font-bold">{when.getDate()}</span>
                      <span className="text-[9px] leading-none tracking-[0.06em] uppercase">{when.toLocaleDateString("en-GB", { month: "short" })}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-ink">{b.title}</span>
                        {b.pinned ? <span className="rounded-full bg-card-inset px-1.5 py-[2px] text-[9.5px] font-bold tracking-[0.08em] text-muted uppercase">Pinned</span> : null}
                      </span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {authorNameById.get(b.author_id) ?? "Unknown"}
                        {b.visible_to_tp_group_id ? ` · ${groupNameById.get(b.visible_to_tp_group_id) ?? "one group"} only` : " · whole cohort"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
