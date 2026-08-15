import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { categorize, toLocalIso } from "@/lib/timetable-grid";
import { CATEGORY_ACCENT } from "@/app/trainer/(hub)/timetable/event-cell";
import { halfTpDates, type TpTimetableEvent } from "@/lib/rotation";

// for-claude-code-trainee-interface.md's Timetable tab -- read-only,
// filtered to this trainee. Grouped by day rather than literally one row
// per day (a real day can carry several events -- input session, TP,
// deadline -- and collapsing those would lose real information), each
// event still rendered as its own detail row underneath its day header.
export default async function TraineeTimetablePage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { traineeId } = await params;
  const { preview } = await searchParams;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();
  const isStaff = (viewer?.role === "trainer" || viewer?.role === "admin") && preview !== "trainee";

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase.from("profiles").select("course_id").eq("id", traineeId).maybeSingle();
  if (!trainee?.course_id) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const today = toLocalIso(new Date());

  const [{ data: events }, { data: plans }, { data: subgroupMember }] = await Promise.all([
    supabase
      .from("course_timetable_events")
      .select("*")
      .eq("course_id", trainee.course_id)
      .order("event_date")
      .order("event_time"),
    supabase.from("plan_assignments").select("tp_number, taught_at").eq("trainee_id", traineeId),
    supabase.from("course_subgroup_members").select("subgroup_id").eq("trainee_id", traineeId).maybeSingle(),
  ]);

  // "Their own TP lessons get a teal left rule" -- only resolvable for a
  // paired subgroup, where a real date maps to a real TP number (same
  // honest limit as Today tab's "you teach today" and the trainer-side TP
  // Marking Queue: an unpaired subgroup has no date system to check
  // against, so every TP event reads as "observed" for those trainees).
  const ownTpDates = new Set<string>();
  if (subgroupMember) {
    const { data: subgroup } = await supabase
      .from("course_subgroups")
      .select("half_order")
      .eq("id", subgroupMember.subgroup_id)
      .maybeSingle();
    if (subgroup?.half_order) {
      const tpTimetableEvents: TpTimetableEvent[] = (events ?? []).filter((e) => e.type === "tp").map((e) => ({ event_date: e.event_date }));
      const halfDates = halfTpDates(tpTimetableEvents, subgroup.half_order);
      const assignedTpNumbers = new Set((plans ?? []).map((p) => p.tp_number));
      halfDates.forEach((date, i) => {
        if (assignedTpNumbers.has(i + 1)) ownTpDates.add(date);
      });
    }
  }

  const eventsByDate = new Map<string, typeof events>();
  for (const e of events ?? []) {
    const list = eventsByDate.get(e.event_date) ?? [];
    list.push(e);
    eventsByDate.set(e.event_date, list);
  }
  const dates = [...eventsByDate.keys()].sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const weekRange =
    firstDate && lastDate
      ? `${new Date(`${firstDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })} – ${new Date(`${lastDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Timetable</p>
          <h1 className="font-serif text-2xl text-ink">{weekRange ?? "Nothing scheduled yet"}</h1>
        </div>
        {!isStaff ? (
          <a
            href={`/api/portfolio/${traineeId}/timetable.ics`}
            className="rounded-[6px] border border-border bg-card px-3.5 py-2 text-sm font-medium text-ink hover:border-primary"
          >
            Add to my calendar
          </a>
        ) : null}
      </div>

      <div className="sheet flex flex-col !p-0">
        {dates.length === 0 ? (
          <p className="p-6 text-sm text-muted">No events yet.</p>
        ) : (
          dates.map((date, i) => {
            const dayEvents = eventsByDate.get(date) ?? [];
            const isToday = date === today;
            return (
              <div key={date} className={`px-5 py-3.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                  {new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                  {isToday ? <span className="pill pill-info ml-2">Today</span> : null}
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {dayEvents.map((event) => {
                    const isOwnTp = event.type === "tp" && ownTpDates.has(event.event_date);
                    const category = categorize(event);
                    const planDue = event.linked_assignment_type && event.event_date >= today;
                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 border-l-[3px] pl-3"
                        style={{ borderLeftColor: isOwnTp ? "var(--color-primary)" : CATEGORY_ACCENT[category] }}
                      >
                        <span className="w-14 shrink-0 text-xs tabular-nums text-muted">{event.event_time?.slice(0, 5) ?? ""}</span>
                        <span className={`flex-1 text-sm ${isOwnTp ? "font-semibold text-ink" : "text-ink"}`}>{event.title}</span>
                        {isOwnTp ? <span className="pill pill-success">Your TP</span> : null}
                        {planDue ? <span className="pill pill-neutral">Plan due</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
