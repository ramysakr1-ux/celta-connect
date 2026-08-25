import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { SessionMaterialsSection } from "@/components/session-materials-section";

// Ramy, 25 Aug 2026: "I thought it would recognize whatever is on the
// timetable... if it says games, it will read games." The GTKY page's
// Materials section only auto-finds an event titled like GTKY -- fine as
// a shortcut for that one specific case, but not what covers "unassessed"
// or literally anything else a trainer titled a session. This is that
// general version: same SessionMaterialsSection/action as the trainer's
// picker (/trainer/session-materials), just scoped to the trainee's own
// course and their own uploads -- no title-matching heuristic at all, the
// trainee just picks the real event off the real timetable. Scoped to
// `shares_materials` events only, not just "anything that isn't a TP" --
// "I don't want it to read lunch for the trainees. That would be
// ridiculous." A trainer opts an event in when creating it.
export default async function TraineeSessionMaterialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  if (!session?.profile) redirect(`/login?next=${encodeURIComponent(`/portfolio/${traineeId}/session-materials`)}`);
  const viewer = session.profile;
  const isStaff = viewer.role === "trainer" || viewer.role === "admin";
  if (!isStaff && viewer.id !== traineeId) redirect("/dashboard");

  const supabase = await createClient();
  const { event: eventId } = await searchParams;

  const { data: trainee } = await supabase.from("profiles").select("course_id").eq("id", traineeId).maybeSingle();
  const courseId = trainee?.course_id;
  if (!courseId) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }

  const { data: events } = await supabase
    .from("course_timetable_events")
    .select("id, title, event_date")
    .eq("course_id", courseId)
    .eq("shares_materials", true)
    .order("event_date");

  const selectedEvent = eventId ? (events ?? []).find((e) => e.id === eventId) : null;
  const { data: materials } = selectedEvent
    ? await supabase
        .from("session_materials")
        .select("id, file_name, file_type, storage_path, slides_url, uploaded_by")
        .eq("timetable_event_id", selectedEvent.id)
        .eq("uploaded_by", traineeId)
        .order("created_at")
    : { data: [] };

  const dateLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Session materials</p>
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
        <div className="card rounded-[9px] border-t-[var(--trainee-plum)] p-6">
          <h2 className="font-serif text-lg text-ink">{selectedEvent.title}</h2>
          <p className="mt-1 mb-4 text-sm text-muted">{dateLabel(selectedEvent.event_date)}</p>
          <SessionMaterialsSection
            timetableEventId={selectedEvent.id}
            courseId={courseId}
            viewerId={traineeId}
            materials={materials ?? []}
            revalidatePath={`/portfolio/${traineeId}/session-materials`}
          />
        </div>
      ) : null}
    </div>
  );
}
