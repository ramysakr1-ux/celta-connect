import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { SessionMaterialsSection } from "@/components/session-materials-section";
import { PageHead } from "@/app/trainer/(hub)/page-head";
import { ShareToggle } from "@/app/trainer/(hub)/session-materials/share-toggle";

// Ramy, 25 Aug 2026: "why can't the trainers upload their demo lesson...
// it would read demo lesson, and then the next one would read getting to
// know you." No existing mechanism let a trainer share material at all --
// every tp_materials write site is trainee-only, and that table needs a
// trainee-owned tp_plans row a trainer teaching a demo lesson never has.
// This shares session_materials with the trainee-facing GTKY page (same
// component, same action) -- the only real difference is which calendar
// event the upload attaches to, picked here from a plain dropdown.
//
// 5 Sep 2026: the dropdown lists EVERY non-TP session on the timetable.
// It used to list only sessions flagged `shares_materials`, and that flag
// could only be ticked while adding a new event -- so on any timetable
// that was seeded or generated (every real one) the list was empty and
// the page claimed "no non-TP sessions", with a Demo lesson sitting right
// there on the timetable. The flag is now a switch on the chosen session.
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

  // TP has its own tp_materials system and is excluded regardless.
  const { data: events } = await supabase
    .from("course_timetable_events")
    .select("id, title, event_date, event_time, type, shares_materials")
    .eq("course_id", courseId)
    .neq("type", "tp")
    .order("event_date")
    .order("event_time");

  const selectedEvent = eventId ? (events ?? []).find((e) => e.id === eventId) : null;
  const { data: materials } = selectedEvent
    ? await supabase.from("session_materials").select("id, file_name, file_type, storage_path, slides_url, uploaded_by").eq("timetable_event_id", selectedEvent.id).order("created_at")
    : { data: [] };

  const dateLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const timeLabel = (t: string | null) => (t ? ` ${t.slice(0, 5)}` : "");
  const sharedCount = (events ?? []).filter((e) => e.shares_materials).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        eyebrow="Timetable · session materials"
        title="Share materials for a session"
        lede="For anything that isn't a graded TP -- a demo lesson, the unassessed teach, an introduction. Volunteer students see whatever the session is titled on the timetable, with whatever you attach here, once sharing is switched on for it."
      />

      <form method="get" className="sheet flex flex-wrap items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-sm text-muted">Session</label>
          <select name="event" defaultValue={eventId ?? ""} className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary">
            <option value="">Choose a session…</option>
            {(events ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {dateLabel(e.event_date)}
                {timeLabel(e.event_time)} — {e.title}
                {e.shares_materials ? " · shared" : ""}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-10 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Open
        </button>
      </form>

      {(events ?? []).length === 0 ? (
        <p className="text-sm text-muted">Nothing on the timetable yet apart from TP. Add sessions on the Timetable tab first.</p>
      ) : (
        <p className="text-xs text-muted">
          {sharedCount === 0
            ? "No session is shared with volunteer students yet -- pick one and switch sharing on."
            : `${sharedCount} session${sharedCount === 1 ? "" : "s"} currently shared with volunteer students (marked "shared" in the list).`}
        </p>
      )}

      {selectedEvent ? (
        <div className="sheet flex flex-col gap-4 p-6">
          <div>
            <h2 className="font-serif text-lg text-ink">{selectedEvent.title}</h2>
            <p className="mt-1 text-sm text-muted">
              {dateLabel(selectedEvent.event_date)}
              {timeLabel(selectedEvent.event_time)}
            </p>
          </div>
          <ShareToggle eventId={selectedEvent.id} shares={Boolean(selectedEvent.shares_materials)} />
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
