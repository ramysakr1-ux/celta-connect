"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { deleteAudioRecord } from "@/app/trainer/(hub)/audio/actions";

type AudioRow = Database["public"]["Tables"]["tp_audio_library"]["Row"];

// `level` is free text, so group order follows real CEFR progression where
// a level matches one, anything else falls back after -- same convention
// as src/components/tp-library/coursebook-list.tsx.
const CEFR_ORDER = ["A1", "A2", "A2+", "B1", "B1+", "B2", "B2+", "C1", "C2"];
function levelRank(level: string): number {
  const i = CEFR_ORDER.indexOf(level.trim());
  return i === -1 ? CEFR_ORDER.length : i;
}

function AudioRowItem({ row }: { row: AudioRow }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePlay() {
    if (signedUrl) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: signError } = await supabase.storage
        .from("tp-audio")
        .createSignedUrl(row.storage_path, 3600);
      if (signError || !data) {
        setError("Could not load this track. Try again.");
        return;
      }
      setSignedUrl(data.signedUrl);
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-[6px] border border-border-faint px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{row.file_name}</p>
          {row.unit_label ? <p className="text-xs text-muted">{row.unit_label}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!signedUrl ? (
            <button
              type="button"
              onClick={handlePlay}
              disabled={loading}
              className="text-sm text-primary hover:underline disabled:opacity-60"
            >
              {loading ? "Loading…" : "Play"}
            </button>
          ) : null}
          <form action={deleteAudioRecord}>
            <input type="hidden" name="audio_id" value={row.id} />
            <button type="submit" className="text-sm text-destructive hover:underline">
              Remove
            </button>
          </form>
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {signedUrl ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- audio tracks from a coursebook, no caption source exists
        <audio controls autoPlay src={signedUrl} className="w-full" />
      ) : null}
    </li>
  );
}

export function AudioList({ rows }: { rows: AudioRow[] }) {
  if (rows.length === 0) {
    return <p className="text-muted">No audio uploaded yet.</p>;
  }

  const byLevel = new Map<string, AudioRow[]>();
  for (const row of rows) {
    const list = byLevel.get(row.level) ?? [];
    list.push(row);
    byLevel.set(row.level, list);
  }
  const levels = [...byLevel.keys()].sort((a, b) => levelRank(a) - levelRank(b) || a.localeCompare(b));

  return (
    <div className="flex flex-col gap-6">
      {levels.map((level) => {
        const byBook = new Map<string, AudioRow[]>();
        for (const row of byLevel.get(level)!) {
          const list = byBook.get(row.coursebook_title) ?? [];
          list.push(row);
          byBook.set(row.coursebook_title, list);
        }
        const books = [...byBook.keys()].sort((a, b) => a.localeCompare(b));

        return (
          <div key={level}>
            <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">{level}</h3>
            <div className="mt-2 flex flex-col gap-4">
              {books.map((book) => (
                <div key={book}>
                  <h4 className="text-sm font-medium text-ink">{book}</h4>
                  <ul className="mt-2 flex flex-col gap-2">
                    {byBook
                      .get(book)!
                      .sort((a, b) => a.file_name.localeCompare(b.file_name, undefined, { numeric: true }))
                      .map((row) => (
                        <AudioRowItem key={row.id} row={row} />
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
