"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type AudioRow = Database["public"]["Tables"]["tp_audio_library"]["Row"];

function TrackRow({ row }: { row: AudioRow }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePlay() {
    if (signedUrl) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: signErr } = await supabase.storage.from("tp-audio").createSignedUrl(row.storage_path, 3600);
      if (signErr || !data) {
        setError("Could not load this track. Try again.");
        return;
      }
      setSignedUrl(data.signedUrl);
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="trainee-hover flex flex-col gap-2 rounded-[6px] border border-border-faint px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{row.file_name}</p>
          {row.unit_label ? <p className="text-xs text-muted">{row.unit_label}</p> : null}
        </div>
        {!signedUrl ? (
          <button type="button" onClick={handlePlay} disabled={loading} className="shrink-0 text-sm text-primary hover:underline disabled:opacity-60">
            {loading ? "Loading…" : "Play"}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {signedUrl ? <audio controls autoPlay src={signedUrl} className="w-full" /> : null}
    </li>
  );
}

// Read-only trainee/portfolio view of the same Audio Library the trainer
// manages at /trainer/audio -- "multimedia yes/yes" in the hub visibility
// table (unlike TP points, this one's meant to be trainee-visible).
export function MultimediaSection({ tracks }: { tracks: AudioRow[] }) {
  // Ramy, 29 Aug 2026: "multimedia, video, other videos -- I don't see
  // audio." It returned null when empty, so with no tracks the audio half
  // vanished entirely and the category looked like it was video-only. An
  // empty shelf should say it is empty, not disappear -- otherwise nobody
  // can tell the difference between "no audio yet" and "audio is not a
  // thing here".
  if (tracks.length === 0) {
    return (
      <div>
        <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">Audio</h3>
        <p className="sheet mt-3 border-dashed text-sm text-muted">
          Coursebook audio your tutors add for teaching practice — nothing here yet.
        </p>
      </div>
    );
  }

  const byBook = new Map<string, AudioRow[]>();
  for (const row of tracks) {
    const list = byBook.get(row.coursebook_title) ?? [];
    list.push(row);
    byBook.set(row.coursebook_title, list);
  }

  return (
    <div>
      <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">Audio</h3>
      <div className="mt-3 flex flex-col gap-4">
        {[...byBook.entries()].map(([book, rows]) => (
          <div key={book}>
            <h4 className="text-sm font-medium text-ink">{book}</h4>
            <ul className="mt-2 flex flex-col gap-2">
              {rows.map((row) => (
                <TrackRow key={row.id} row={row} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
