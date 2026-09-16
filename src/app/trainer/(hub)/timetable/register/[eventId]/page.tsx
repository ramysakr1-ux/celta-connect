import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { setAttendance } from "@/app/trainer/(hub)/timetable/actions";
import { PageHead } from "@/app/trainer/(hub)/page-head";
import { BackLink } from "@/components/back-link";
import { shortDate, shortTime } from "@/lib/tutorials-section";
import { formatDateTime } from "@/lib/format-date";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

// The volunteer register for one TP session.
//
// Walked 14 Sep 2026: the hub tells an assistant tutor their register is
// missing -- scoped to their own group's rooms, deliberately ("the other
// group's rooms are the other tutor's registers") -- and setAttendance was
// deliberately left ungated, because taking the register is a day-of
// teaching task, not a timetable edit. But the only place the form existed
// was inside Edit timetable, which is MCT-only, so the one tutor who was
// actually in the room could not submit it.
//
// So the register gets its own room, reached from the session's own tile on
// the board every tutor already reads.
export default async function RegisterPage({ params }: { params: Promise<{ eventId: string }> }) {
  const trainer = await requireRole(["trainer", "admin"]);
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("id, course_id, title, detail, event_date, event_time, type, register_submitted_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.course_id !== trainer.course_id || event.type !== "tp") notFound();

  const [{ data: volunteers }, { data: attendance }, { data: declines }] = await Promise.all([
    supabase.from("volunteer_students").select("id, name, level, removed_at").eq("course_id", event.course_id).is("removed_at", null).order("name"),
    supabase.from("volunteer_attendance").select("volunteer_student_id, source").eq("timetable_event_id", eventId),
    supabase.from("volunteer_declines").select("volunteer_student_id").eq("timetable_event_id", eventId),
  ]);
  const attended = new Set((attendance ?? []).map((a) => a.volunteer_student_id));
  const viaZoom = new Set((attendance ?? []).filter((a) => a.source === "zoom").map((a) => a.volunteer_student_id));
  const declined = new Set((declines ?? []).map((d) => d.volunteer_student_id));
  const timeZone = (await getCachedCenter(trainer.center_id))?.time_zone ?? DEFAULT_TIMEZONE;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/trainer/timetable" label="Timetable" />
      <PageHead
        eyebrow="Timetable · register"
        title={`Register · ${event.title}`}
        lede={`${shortDate(event.event_date)} · ${shortTime(event.event_time)}${event.detail ? ` · ${event.detail}` : ""}. Tick who was in the room. Saving with nobody ticked is a real answer -- it records that the register was taken and the class was empty.`}
      />

      <form
        action={setAttendance}
        className="flex flex-col gap-3.5 rounded-[12px] border-[1.5px] px-6 py-5"
        style={{ background: "color-mix(in oklab, var(--hub-accent) 9%, var(--color-card))", borderColor: "var(--hub-accent)" }}
      >
        <input type="hidden" name="event_id" value={event.id} />
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-h2 font-semibold text-ink-warm">Who came</h2>
          <span className="text-meta text-muted">
            {event.register_submitted_at
              ? `Last taken ${formatDateTime(event.register_submitted_at, timeZone)}`
              : "Not taken yet"}
          </span>
        </div>

        {(volunteers ?? []).length === 0 ? (
          <p className="text-body text-muted">No volunteer students on this course yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border-faint">
            {(volunteers ?? []).map((v) => (
              <label key={v.id} className="wash flex items-center gap-3 rounded-[8px] px-2 py-2.5 text-body text-ink">
                <input type="checkbox" name="attended_volunteer_id" value={v.id} defaultChecked={attended.has(v.id)} className="size-4" />
                <span className="flex-1">
                  {v.name}
                  {/* Two groups teach two levels in parallel, and the
                      volunteers belong to a class, not to the course -- the
                      level is how a tutor tells their own room's students
                      from the other room's. Shown, not filtered on: the
                      level is free text on the volunteer, and a register
                      that silently hides someone who walked in is worse
                      than one that lists a name too many. */}
                  {v.level ? <span className="ml-2 text-meta text-muted">{v.level}</span> : null}
                </span>
                {viaZoom.has(v.id) ? <span className="pill pill-neutral text-micro">via Zoom</span> : null}
                {declined.has(v.id) ? <span className="pill pill-neutral text-micro">said they could not come</span> : null}
              </label>
            ))}
          </div>
        )}

        <button
          type="submit"
          className="mt-1 inline-flex h-9 w-fit items-center rounded-full px-5 text-meta font-semibold text-primary-foreground"
          style={{ background: "var(--hub-accent)" }}
        >
          Save the register
        </button>
      </form>
    </div>
  );
}
