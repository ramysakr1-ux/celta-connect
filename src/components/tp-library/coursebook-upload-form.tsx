"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CoursebookUploadForm({
  centerId,
  action,
}: {
  centerId: string;
  action: (input: {
    title: string;
    level: string;
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
    const title = formData.get("title");
    const level = formData.get("level");
    const file = formData.get("file");

    if (typeof title !== "string" || !title || typeof level !== "string" || !level) {
      setError("Give the coursebook a title and level.");
      return;
    }
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a PDF file.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const storagePath = `${centerId}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("coursebook-pdfs")
        .upload(storagePath, file, { contentType: "application/pdf" });

      if (uploadError) {
        setError(`Could not upload the PDF: ${uploadError.message}`);
        return;
      }

      const result = await action({
        title,
        level,
        storagePath,
        originalFilename: file.name,
      });
      if (result.error) {
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4 p-6">
      <h2 className="font-serif text-lg text-ink">Upload a coursebook</h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm text-muted">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g. Speakout 3rd Edition"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>
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
        <label htmlFor="file" className="text-sm text-muted">
          Coursebook PDF
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf"
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
          "Upload"
        )}
      </button>
    </form>
  );
}
