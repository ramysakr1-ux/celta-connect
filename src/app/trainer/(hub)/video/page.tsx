import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { AddVideoForm } from "@/app/trainer/(hub)/video/add-video-form";
import { deleteVideoRecord } from "@/app/trainer/(hub)/video/actions";

// TP Video Library: a plain, separate library of external training-video
// links (Cambridge's own filmed-observation DVD library, etc.) -- link-
// based rather than uploaded, since Supabase's free-tier Storage caps
// individual files at 50MB and these run 200-260MB+ (Ramy, 2026-08-21).
// Same shape as /trainer/audio, just video instead of audio, and a link
// instead of a file. Deliberately NOT the same thing as "filmed
// observation" (your own cohort's live-filmed lesson, task-linked,
// consent-tracked, timetable-bound) -- see migration 0189's own comment.
export default async function TrainerVideoLibraryPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const supabase = await createClient();

  const { data: videos } = await supabase
    .from("tp_video_library")
    .select("*")
    .eq("center_id", trainer.center_id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="sheet p-6">
        <h1 className="font-serif text-xl text-ink">Video Library</h1>
        <p className="mt-2 text-muted">
          Training and observation videos -- hosted wherever you like, linked here. Not the same as a candidate&apos;s
          own filmed observation (that&apos;s tied to a real timetable session and a task); this is a plain, browsable
          shelf, visible to your whole cohort.
        </p>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Videos</h2>
        <div className="mt-3 flex flex-col gap-2">
          {(videos ?? []).length === 0 ? (
            <p className="sheet p-4 text-sm text-muted">No videos added yet.</p>
          ) : (
            (videos ?? []).map((v) => (
              <div key={v.id} className="sheet flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <a href={v.video_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                    {v.title}
                  </a>
                  {v.description ? <p className="mt-1 text-sm text-muted">{v.description}</p> : null}
                </div>
                <form action={deleteVideoRecord}>
                  <input type="hidden" name="video_id" value={v.id} />
                  <button type="submit" className="shrink-0 text-xs text-muted hover:text-destructive">
                    Delete
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </div>

      <AddVideoForm />
    </div>
  );
}
