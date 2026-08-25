import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { SessionMaterialsSection } from "@/components/session-materials-section";

// Ramy, 25 Aug 2026: "why can't the trainers upload their demo lesson...
// it would read demo lesson, and then the next one would read getting to
// know you." No existing mechanism let a trainer share material at all --
// every tp_materials write site is trainee-only, and that table needs a
// trainee-owned tp_plans row a trainer teaching a demo lesson never has.
// This shares session_materials with the trainee-facing GTKY page (same
// component, same action) -- the only real difference is which calendar
// event the upload attaches to, picked here from a plain dropdown rather
// than matched by title, since a trainer isn't tied to one specific event
// the way GTKY is tied to "whichever milestone is titled like GTKY."
export default async function SessionMaterialsPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile || (profile.role !== "trainer" && profile.role !== "admin" && profile.role !== "platform_owner")) redirect("/login");
  const courseId = profile.course_id;
  if (!courseId) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }

  const supabase = await createClient();
  const { event: eventId } = await searchParams;

  // Only events a trainer explicitly opted in via the "shares materials"
  // checkbox on the timetable form -- "I don't want it to read lunch for
  // the trainees. That would be ridiculous." (Ramy, 25 Aug 2026). TP has
  // its own tp_materials system already and is excluded regardless.
  const { data: events } = await supabase
    .from("course_timetable_events")
    .select("id, title, event_date")
    .eq("course_id", courseId)
    .eq("shares_materials", true)
    .order("event_date");

  const selectedEvent = eventId ? (events ?? []).find((e) => e.id === eventId) : null;
  const { data: materials } = selectedEvent
    ? await supabase.from("session_materials").select("id, file_name, file_type, storage_path, slides_url, uploaded_by").eq("timetable_event_id", selectedEvent.id).order("created_at")
    : { data: [] };

  const dateLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Timetable · session materials</p>
        <h1 className="font-serif text-2xl text-ink">Share materials for a session</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          For anything that isn&apos;t a graded TP -- a demo lesson. Volunteer students see whatever the session is titled on the
          timetable, with whatever you attach here.
        </p>
      </div>

      <form method="get" className="sheet flex flex-wrap items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-sm text-muted">Session</label>
          <select name="event" defaultValue={eventId ?? ""} className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary">
            <option value="">Choose a session…</option>
            {(events ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {dateLabel(e.event_date)} — {e.title}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-10 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Open
        </button>
      </form>

      {(events ?? []).length === 0 ? <p className="text-sm text-muted">No non-TP sessions on the timetable yet.</p> : null}

      {selectedEvent ? (
        <div className="card rounded-[9px] p-6">
          <h2 className="font-serif text-lg text-ink">{selectedEvent.title}</h2>
          <p className="mt-1 mb-4 text-sm text-muted">{dateLabel(selectedEvent.event_date)}</p>
          <SessionMaterialsSection
            timetableEventId={selectedEvent.id}
            courseId={courseId}
            viewerId={profile.id}
            materials={materials ?? []}
            revalidatePath="/trainer/session-materials"
          />
        </div>
      ) : null}
    </div>
  );
}
