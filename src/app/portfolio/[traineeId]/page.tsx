import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { BroadcastComposer } from "@/app/portfolio/[traineeId]/broadcast-composer";
import { deleteBroadcast } from "@/app/portfolio/[traineeId]/stream-actions";

const EVENT_TYPE_LABELS: Record<string, string> = {
  input_session: "Input session",
  tp: "Teaching practice",
  assignment_due: "Assignment due",
  resubmission_due: "Resubmission due",
  milestone: "Milestone",
};

// §4 Course Stream -- the default tab behind the portfolio link.
export default async function CourseStreamPage({
  params,
}: {
  params: Promise<{ traineeId: string }>;
}) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  if (!session?.profile) notFound();
  const viewer = session.profile;

  const supabase = await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("course_id")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee?.course_id) notFound();

  const isStaff = viewer.role === "trainer" || viewer.role === "admin";
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: broadcasts }, { data: timetableEvents }, { data: tutors }] = await Promise.all([
    supabase
      .from("course_broadcasts")
      .select("*, profiles(full_name, role)")
      .eq("course_id", trainee.course_id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("course_timetable_events")
      .select("*")
      .eq("course_id", trainee.course_id)
      .gte("event_date", today)
      .order("event_date")
      .order("event_time")
      .limit(4),
    supabase.from("profiles").select("full_name, role").eq("course_id", trainee.course_id).eq("role", "trainer"),
  ]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-ink">Course Stream</h2>
          <p className="text-xs text-muted">{(broadcasts ?? []).length} broadcasts</p>
        </div>

        {isStaff ? <BroadcastComposer traineeId={traineeId} /> : null}

        {(broadcasts ?? []).length === 0 ? (
          <p className="sheet text-sm text-muted">No broadcasts yet.</p>
        ) : (
          (broadcasts ?? []).map((b) => {
            const author = b.profiles as unknown as { full_name: string; role: string } | null;
            const initials = (author?.full_name ?? "?")
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <div key={b.id} className="sheet">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                      <span className="text-xs font-semibold text-muted">{initials}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{author?.full_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted">
                        {[author?.role, new Date(b.created_at).toLocaleString()].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  {b.pinned ? (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold text-gold-foreground">
                      Pinned
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 font-serif text-xl font-medium text-ink">{b.title}</p>
                {b.body ? <p className="mt-1 text-base whitespace-pre-wrap text-muted">{b.body}</p> : null}

                {b.zoom_url ? (
                  <a
                    href={b.zoom_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex items-center gap-3 rounded-[6px] border border-primary/25 bg-accent/50 px-3 py-2.5 transition-colors hover:bg-accent"
                  >
                    <span aria-hidden="true">🎥</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">Join Zoom session</span>
                      {b.zoom_time ? (
                        <span className="block text-xs text-muted">{new Date(b.zoom_time).toLocaleString()}</span>
                      ) : null}
                    </span>
                    <span className="text-sm font-medium text-primary">Open</span>
                  </a>
                ) : null}

                {b.attachment_url ? (
                  <a
                    href={b.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sheet-interactive mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink"
                  >
                    📎 {b.attachment_name ?? "Attachment"}
                  </a>
                ) : null}

                {isStaff ? (
                  <form action={deleteBroadcast} className="mt-3">
                    <input type="hidden" name="broadcast_id" value={b.id} />
                    <input type="hidden" name="trainee_id" value={traineeId} />
                    <button type="submit" className="text-xs text-destructive hover:underline">
                      Remove
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="sheet h-fit lg:sticky lg:top-6">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">This week</p>
        {(timetableEvents ?? []).length > 0 ? (
          <ul className="mt-3 flex flex-col">
            {(timetableEvents ?? []).map((event, i) => (
              <li
                key={event.id}
                className={`py-3 ${i > 0 ? "border-t border-border" : "pt-0"}`}
              >
                <p className="text-sm font-semibold text-ink">{event.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {[EVENT_TYPE_LABELS[event.type], event.event_date, event.event_time].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">Nothing scheduled yet.</p>
        )}

        <p className="mt-6 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Course tutors</p>
        {(tutors ?? []).length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {(tutors ?? []).map((tutor, i) => (
              <li key={i} className="text-sm text-ink">
                {tutor.full_name}
                <span className="ml-1 text-xs text-muted">Trainer</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No tutors assigned yet.</p>
        )}
      </div>
    </div>
  );
}
