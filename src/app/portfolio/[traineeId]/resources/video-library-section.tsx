import type { Database } from "@/lib/supabase/types";

type VideoRow = Database["public"]["Tables"]["tp_video_library"]["Row"];

// Read-only trainee/portfolio view of the same Video Library the trainer
// manages at /trainer/video -- link-based, same reasoning as the audio
// library's read-only trainee view, just no signed-URL step since these
// are plain external links, not Storage-uploaded files.
export function VideoLibrarySection({ videos }: { videos: VideoRow[] }) {
  if (videos.length === 0) return null;

  return (
    <div>
      <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">Video Library</h3>
      <p className="mt-1 text-xs text-muted">
        Some of these run well over 45 minutes. Skim ahead and fast-forward to the parts your task asks about — you
        don&apos;t need to watch start to finish.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {videos.map((v) => (
          <li key={v.id} className="rounded-[6px] border border-border-faint px-3 py-2">
            <a href={v.video_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
              {v.title}
            </a>
            {v.description ? <p className="mt-1 text-xs text-muted">{v.description}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
