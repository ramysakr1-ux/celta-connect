import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { deleteTimetableEvent, setTimetableLock } from "@/app/trainer/timetable/actions";
import { AddEventForm } from "@/app/trainer/timetable/add-event-form";

const EVENT_TYPE_LABELS: Record<string, string> = {
  input_session: "Input session",
  tp: "Teaching practice",
  assignment_due: "Assignment due",
  resubmission_due: "Resubmission due",
  milestone: "Milestone",
};

// §1.1a -- the course timetable is the single source of truth for the
// whole course clock (This Week panel, due/overdue states, TP dates). This
// is the first-stage editor: a plain list, add/delete, and a lock toggle --
// not yet the full reusable-skeleton/week-grid/colour-by-tag builder the
// doc describes as the target, which the doc explicitly allows building in
// later stages on top of this same data shape.
export default async function TrainerTimetablePage() {
  const trainer = await requireRole("trainer");
  const supabase = await createClient();

  if (!trainer.course_id) {
    return (
      <div className="sheet text-sm text-muted">No course assigned.</div>
    );
  }

  const [{ data: course }, { data: events }] = await Promise.all([
    supabase.from("courses").select("timetable_locked_at").eq("id", trainer.course_id).maybeSingle(),
    supabase
      .from("course_timetable_events")
      .select("*")
      .eq("course_id", trainer.course_id)
      .order("event_date")
      .order("event_time"),
  ]);

  const locked = Boolean(course?.timetable_locked_at);

  return (
    <div className="flex flex-col gap-6">
      <div className="sheet flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl text-ink">Course timetable</h1>
          <p className="mt-2 text-muted">
            The single source of truth for the course clock -- This Week, due dates, and TP
            dates all read from this.
          </p>
        </div>
        <form action={setTimetableLock}>
          <input type="hidden" name="lock" value={(!locked).toString()} />
          <button
            type="submit"
            className={`rounded-[6px] border px-4 py-2 text-sm font-medium ${
              locked
                ? "border-border text-ink hover:border-primary"
                : "border-primary bg-primary text-primary-foreground"
            }`}
          >
            {locked ? "Unlock timetable" : "Lock timetable"}
          </button>
        </form>
      </div>

      {locked ? (
        <div className="sheet border-primary/20 bg-accent/30 text-sm text-ink">
          Locked -- the course clock now calculates off these dates. Unlock to make changes.
        </div>
      ) : null}

      {!locked ? (
        <div className="sheet">
          <h2 className="font-serif text-lg text-ink">Add event</h2>
          <AddEventForm />
        </div>
      ) : null}

      <div className="sheet overflow-hidden !p-0">
        {events && events.length > 0 ? (
          <ul>
            {events.map((event) => (
              <li key={event.id} className="list-row flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-ink">
                    <span className="font-medium">{event.title}</span>{" "}
                    <span className="text-muted">({EVENT_TYPE_LABELS[event.type]})</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {[
                      event.event_date,
                      event.event_time,
                      event.tag,
                      event.linked_tp_number ? `TP${event.linked_tp_number}` : null,
                      event.linked_assignment_type
                        ? ASSIGNMENT_INFO[event.linked_assignment_type as keyof typeof ASSIGNMENT_INFO]?.title
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {!locked ? (
                  <form action={deleteTimetableEvent}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <button type="submit" className="text-sm text-destructive hover:underline">
                      Remove
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-muted">No events yet.</p>
        )}
      </div>
    </div>
  );
}
