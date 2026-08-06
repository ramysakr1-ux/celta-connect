"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Known coursebook titles already in the TP Points Library (see
// tp_coursebooks) minus the "(Set N)" suffix -- audio applies to the whole
// book regardless of which generated set a TP point came from. Offered as
// a datalist, not a hard enum: a centre can still type a new title for a
// book that isn't in the library yet.
const KNOWN_COURSEBOOKS = [
  "Roadmap A2+",
  "Speakout 3rd Edition A1",
  "Speakout 3rd Edition A2+",
  "Speakout 3rd Edition B1",
  "Speakout 3rd Edition B2",
];

export function AudioUploadForm({
  centerId,
  action,
}: {
  centerId: string;
  action: (input: {
    level: string;
    coursebookTitle: string;
    unitLabel?: string | null;
    fileName: string;
    storagePath: string;
    originalFilename: string;
  }) => Promise<{ error: string | null }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const level = formData.get("level");
    const coursebookTitle = formData.get("coursebook_title");
    const unitLabel = formData.get("unit_label");
    const fileName = formData.get("file_name");
    const file = formData.get("file");

    if (typeof level !== "string" || !level || typeof coursebookTitle !== "string" || !coursebookTitle) {
      setError("Give the track a level and coursebook title.");
      return;
    }
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose an audio file.");
      return;
    }
    const finalFileName = typeof fileName === "string" && fileName.trim() ? fileName.trim() : file.name;

    setPending(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "mp3";
      const storagePath = `${centerId}/${level.trim()}/${coursebookTitle.trim()}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("tp-audio")
        .upload(storagePath, file, { contentType: file.type || "audio/mpeg" });

      if (uploadError) {
        setError(`Could not upload the file: ${uploadError.message}`);
        return;
      }

      const result = await action({
        level: level.trim(),
        coursebookTitle: coursebookTitle.trim(),
        unitLabel: typeof unitLabel === "string" && unitLabel.trim() ? unitLabel.trim() : null,
        fileName: finalFileName,
        storagePath,
        originalFilename: file.name,
      });
      if (result.error) {
        setError(result.error);
      } else {
        form.reset();
        setSelectedFile(null);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4 p-6">
      <div>
        <h2 className="font-serif text-lg text-ink">Add a track</h2>
        <p className="mt-1 text-sm text-muted">
          Name the file to match how the TP points already refer to it in their procedure text (e.g. a procedure
          that says &ldquo;Recording 4.03&rdquo; should be named <code>Recording_4.03.mp3</code>) -- that&rsquo;s
          what will let a future pass auto-link mentions to tracks without retagging anything by hand.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="level" className="text-sm text-muted">
            Level
          </label>
          <input
            id="level"
            name="level"
            type="text"
            required
            placeholder="e.g. A2+"
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="coursebook_title" className="text-sm text-muted">
            Coursebook
          </label>
          <input
            id="coursebook_title"
            name="coursebook_title"
            type="text"
            required
            list="known-coursebooks"
            placeholder="e.g. Speakout 3rd Edition B2"
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
          />
          <datalist id="known-coursebooks">
            {KNOWN_COURSEBOOKS.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="unit_label" className="text-sm text-muted">
            Unit (optional)
          </label>
          <input
            id="unit_label"
            name="unit_label"
            type="text"
            placeholder="e.g. Unit 4"
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="file_name" className="text-sm text-muted">
            Display name (optional, defaults to the filename)
          </label>
          <input
            id="file_name"
            name="file_name"
            type="text"
            placeholder="e.g. Recording_4.03.mp3"
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="file" className="text-sm text-muted">
          Audio file
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="audio/*"
          required
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          className="text-sm text-ink"
        />
        {selectedFile ? (
          <p className="text-sm text-muted">
            Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
          </p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? (
          <>
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-card border-t-transparent"
            />
            Uploading...
          </>
        ) : (
          "Add track"
        )}
      </button>
    </form>
  );
}
