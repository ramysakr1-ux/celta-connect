import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { setTimetableLock } from "@/app/trainer/(hub)/timetable/actions";
import { AddEventForm } from "@/app/trainer/(hub)/timetable/add-event-form";
import { GenerateSkeletonForm } from "@/app/trainer/(hub)/timetable/generate-skeleton-form";
import { DragBoard } from "@/app/trainer/(hub)/timetable/drag-board";
import { TimeBandsForm } from "@/app/trainer/(hub)/timetable/time-bands-form";
import { resolveTimeBands } from "@/lib/timetable-grid";
import { Stage2Section } from "@/app/trainer/(hub)/timetable/stage2-section";
import { LaptopOnlyGate } from "@/components/laptop-only-gate";

// §1.1a v2 -- the course timetable is the single source of truth for the
// whole course clock (This Week panel, due/overdue states, TP dates).
// Transposed grid orientation, settled 5 Aug 2026: days as rows, time bands
// as columns, admin & deadlines as the leading column, sticky floating time
// band. See CELTA-Connect-timetable-handoff-for-code.md and the sanctioned
// reference C14-timetable-A-floating.html.
export default async function TrainerTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ lock_error?: string }>;
}) {
  const trainer = await requireRole(["trainer", "admin"]);
  const { lock_error } = await searchParams;
  const supabase = await createClient();

  if (!trainer.course_id) {
    return (
      <div className="sheet text-sm text-muted">No course assigned.</div>
    );
  }

  const [{ data: course }, { data: events }, { data: volunteers }] = await Promise.all([
    supabase.from("courses").select("timetable_locked_at, time_bands").eq("id", trainer.course_id).maybeSingle(),
    supabase
      .from("course_timetable_events")
      .select("*")
      .eq("course_id", trainer.course_id)
      .order("event_date")
      .order("event_time"),
    supabase.from("volunteer_students").select("id, name").eq("course_id", trainer.course_id).is("removed_at", null).order("name"),
  ]);

  const locked = Boolean(course?.timetable_locked_at);
  const timeBands = resolveTimeBands(course?.time_bands ?? null);
  const isCustomTimeBands = Boolean(course?.time_bands && course.time_bands.length > 0);

  // The grid no longer prints a strong week header of its own (apply-to-app.md
  // §2.7), so the page header carries the overall date range instead.
  const weekRange = (() => {
    if (!events || events.length === 0) return null;
    const dates = [...events].map((e) => e.event_date).sort();
    const fmt = (iso: string) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    const first = dates[0];
    const last = dates[dates.length - 1];
    return first === last ? fmt(first) : `${fmt(first)} – ${fmt(last)}`;
  })();

  const tpEventIds = (events ?? []).filter((e) => e.type === "tp").map((e) => e.id);
  const { data: attendanceRows } =
    tpEventIds.length > 0
      ? await supabase.from("volunteer_attendance").select("volunteer_student_id, timetable_event_id").in("timetable_event_id", tpEventIds)
      : { data: [] };
  const attendedByEvent = new Map<string, Set<string>>();
  for (const row of attendanceRows ?? []) {
    const set = attendedByEvent.get(row.timetable_event_id) ?? new Set<string>();
    set.add(row.volunteer_student_id);
    attendedByEvent.set(row.timetable_event_id, set);
  }

  // Stage 2 tutorial booking sheet (3a) -- groups list matches Rotation's
  // own paired-tp-group / unpaired-subgroup enumeration exactly, and blocks
  // aren't gated by timetable_locked_at: tutorials get scheduled as the
  // course actually progresses, well after the base shape is locked.
  const [{ data: subgroups }, { data: tpGroups }, { data: blocks }] = await Promise.all([
    supabase.from("course_subgroups").select("id, name, tp_group_id").eq("course_id", trainer.course_id).order("created_at"),
    supabase.from("course_tp_groups").select("id, name").eq("course_id", trainer.course_id),
    supabase
      .from("stage2_tutorial_blocks")
      .select("id, tp_group_id, subgroup_id, timetable_event_id")
      .eq("course_id", trainer.course_id),
  ]);
  const pairedTpGroupIds = new Set((subgroups ?? []).filter((s) => s.tp_group_id).map((s) => s.tp_group_id));
  const stage2Groups = [
    ...(tpGroups ?? []).filter((g) => pairedTpGroupIds.has(g.id)).map((g) => ({ kind: "tpgroup" as const, id: g.id, name: g.name })),
    ...(subgroups ?? []).filter((s) => !s.tp_group_id).map((s) => ({ kind: "subgroup" as const, id: s.id, name: s.name })),
  ];
  const blockEventById = new Map((events ?? []).map((e) => [e.id, e]));
  const stage2Blocks = (blocks ?? []).map((b) => {
    const event = blockEventById.get(b.timetable_event_id);
    const group = stage2Groups.find((g) => (b.tp_group_id ? g.id === b.tp_group_id : g.id === b.subgroup_id));
    return { id: b.id, groupName: group?.name ?? "Unknown group", eventDate: event?.event_date ?? "" };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="sheet flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl text-ink">Course timetable</h1>
          {weekRange ? <p className="mt-1 font-serif text-2xl text-ink">{weekRange}</p> : null}
          <p className="mt-2 text-muted">
            The single source of truth for the course clock -- This Week, due dates, and TP
            dates all read from this.
          </p>
        </div>
        <form action={setTimetableLock} className="hidden md:block">
          <input type="hidden" name="lock" value={(!locked).toString()} />
          <button
            type="submit"
            className={`flex items-center gap-2 rounded-[6px] border px-4 py-2 text-sm font-medium ${
              locked
                ? "border-border text-ink hover:border-primary"
                : "border-primary bg-primary text-primary-foreground"
            }`}
          >
            {locked ? <span className="size-[5px] shrink-0 rounded-full bg-gold" /> : null}
            {locked ? "Unlock timetable" : "Lock timetable"}
          </button>
        </form>
      </div>

      {locked ? (
        <div className="sheet border-primary/20 bg-accent/30 text-sm text-ink">
          Locked -- the course clock now calculates off these dates. Unlock to make changes.
        </div>
      ) : null}

      {lock_error === "async_missing_link" ? (
        <div className="sheet border-destructive/30 bg-destructive/10 text-sm text-destructive">
          Can&apos;t lock -- an asynchronous input session has no linked live follow-up slot (Handbook
          2.2). Add the link on that session, or add the live slot first.
        </div>
      ) : null}

      {/* Everything below is genuinely editing (add/generate/lock/book) --
          specs/build-spec.md §7 "Laptop only: ... editing the timetable."
          TimetableGrid further down is deliberately OUTSIDE this gate: its
          own mobile-day-view already exists and does real work on a phone
          (browsing the day, marking volunteer attendance) -- gating that too
          would remove working functionality, not just shrink a cramped one. */}
      <LaptopOnlyGate task="Adding events, generating the skeleton, time bands, and Stage 2 booking">
      {!locked && events && events.length === 0 ? (
        <div className="sheet border-primary/20 bg-accent/20">
          <h2 className="font-serif text-lg text-ink">Start from the standard skeleton</h2>
          <p className="mt-1 text-sm text-muted">
            Generates the usual 4-week CELTA shape -- 8 teaching practices, all 4 written
            assignments, VO1-3, Stage 1 &amp; 2 tutorials -- anchored to a real start date. Nobody
            builds a course from a blank grid: tweak or remove anything below afterwards.
          </p>
          <GenerateSkeletonForm />
        </div>
      ) : null}

      {!locked ? (
        <div className="sheet">
          <TimeBandsForm timeBands={timeBands} isCustom={isCustomTimeBands} />
        </div>
      ) : null}

      {!locked ? (
        <div className="sheet">
          <h2 className="font-serif text-lg text-ink">Add event</h2>
          <p className="mt-1 text-sm text-muted">
            Add a single dated item to the timetable below -- an input session, a TP, an
            assignment or resubmission due date, or a milestone.
          </p>
          <AddEventForm
            existingEvents={(events ?? []).map((e) => ({ id: e.id, title: e.title, event_date: e.event_date }))}
            tpGroups={tpGroups ?? []}
          />
        </div>
      ) : null}

      <Stage2Section groups={stage2Groups} blocks={stage2Blocks} />
      </LaptopOnlyGate>

      {events && events.length > 0 ? (
        <div className="sheet">
          <DragBoard events={events} locked={locked} volunteers={volunteers ?? []} attendedByEvent={attendedByEvent} />
        </div>
      ) : (
        <div className="sheet text-sm text-muted">No events yet.</div>
      )}
    </div>
  );
}
