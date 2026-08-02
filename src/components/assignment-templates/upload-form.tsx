"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AssignmentTypeValue } from "@/lib/assignment-templates/content";

export function AssignmentBriefUploadForm({
  centerId,
  assignmentType,
  action,
}: {
  centerId: string;
  assignmentType: AssignmentTypeValue;
  action: (input: {
    assignmentType: AssignmentTypeValue;
    storagePath: string;
    originalFilename: string;
  }) => Promise<{ error: string | null }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a PDF file.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const storagePath = `${centerId}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("assignment-briefs")
        .upload(storagePath, file, { contentType: "application/pdf" });

      if (uploadError) {
        setError(`Could not upload the PDF: ${uploadError.message}`);
        return;
      }

      const result = await action({ assignmentType, storagePath, originalFilename: file.name });
      if (result.error) setError(result.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Brief (PDF)</label>
        <input type="file" name="file" accept="application/pdf" required className="text-sm text-ink" />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Uploading..." : "Upload brief"}
      </button>
    </form>
  );
}
