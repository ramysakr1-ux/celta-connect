import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { toLocalIso } from "@/lib/timetable-grid";
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
  const supabase = await createClient();
  const courseId = trainer.course_id;
  const today = toLocalIso(new Date());

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
  const composerGroups = (tpGroups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: (subgroupIdsByTpGroup.get(g.id) ?? []).reduce((sum, sid) => sum + (memberCountBySubgroup.get(sid) ?? 0), 0),
  }));

  const authorIds = [...new Set((broadcasts ?? []).map((b) => b.author_id))];
  const { data: authors } = authorIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", authorIds) : { data: [] };
  const authorNameById = new Map((authors ?? []).map((a) => [a.id, a.full_name]));

  const showAssessorTemplate = (() => {
    if (!course?.assessor_visit_date) return false;
    const daysUntil = Math.ceil(
      (new Date(`${course.assessor_visit_date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000
    );
    return daysUntil >= 0 && daysUntil <= 2;
  })();

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
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Announcements</h1>
        <p className="mt-1 text-sm text-muted">
          The only way to reach the whole cohort at once -- there&apos;s no cohort chat channel. Candidates see these on
          their home screen, above their to-do list.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <AnnouncementComposer
          timetableEvents={upcomingEvents ?? []}
          showAssessorTemplate={showAssessorTemplate}
          traineeCount={traineeCount ?? 0}
          trainerCount={trainerCount ?? 0}
          groups={composerGroups}
        />

        <ScheduledPanel scheduled={scheduledRows} timetableEvents={editPickerEvents} />

        <div className="rounded-[6px] border border-border">
          <p className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Posted · {posted.length}
          </p>
          {posted.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Nothing posted yet.</p>
          ) : (
            <div className="divide-y divide-border-faint">
              {posted.map((b) => (
                <div key={b.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{b.title}</p>
                    {b.pinned ? <span className="pill pill-gold">Pinned</span> : null}
                  </div>
                  <p className="text-xs text-muted">
                    {authorNameById.get(b.author_id) ?? "Unknown"} · {(b.sent_at ?? b.created_at).slice(0, 10)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
