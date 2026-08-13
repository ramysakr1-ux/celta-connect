"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Source {
  id: string;
  label: string | null;
  original_filename: string | null;
}

export function AdditionalSources({
  coursebookId,
  centerId,
  sources,
  addAction,
  removeAction,
}: {
  coursebookId: string;
  centerId: string;
  sources: Source[];
  addAction: (input: {
    tpCoursebookId: string;
    label: string;
    storagePath: string;
    originalFilename: string;
  }) => Promise<{ error: string | null }>;
  removeAction: (formData: FormData) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a PDF file.");
      return;
    }
    if (!label.trim()) {
      setError("Give this source a label, e.g. Workbook or Teacher's Book.");
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

      const result = await addAction({
        tpCoursebookId: coursebookId,
        label: label.trim(),
        storagePath,
        originalFilename: file.name,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setLabel("");
        form.reset();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-ink">Additional sources</h3>
      <p className="text-xs text-muted">
        Add the Workbook, Teacher&apos;s Book, or other companion PDFs so generation can draw on all of them
        together, alongside the Student&apos;s Book uploaded above.
      </p>

      {sources.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink"
            >
              <span>
                {s.label || s.original_filename || "Additional source"}
                {s.original_filename && s.label ? (
                  <span className="text-muted"> ({s.original_filename})</span>
                ) : null}
              </span>
              <form action={removeAction}>
                <input type="hidden" name="source_id" value={s.id} />
                <input type="hidden" name="coursebook_id" value={coursebookId} />
                <button type="submit" className="text-xs text-destructive hover:underline">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="source_label" className="text-xs text-muted">
            Label
          </label>
          <input
            id="source_label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            type="text"
            placeholder="e.g. Workbook"
            className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="source_file" className="text-xs text-muted">
            PDF
          </label>
          <input id="source_file" name="file" type="file" accept="application/pdf" className="text-sm text-ink" />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] border border-border px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-60"
        >
          {pending ? "Uploading..." : "Add source"}
        </button>
      </form>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
