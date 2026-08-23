"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addResource, type FormState } from "@/app/portfolio/[traineeId]/resources/actions";
import { RESOURCE_CATEGORY_LABELS, RESOURCE_CATEGORY_ORDER, RESOURCE_TYPE_LABELS, RESOURCE_TYPE_ORDER } from "@/lib/resource-info";
import type { ResourceCategory } from "@/lib/supabase/types";

const initialState: FormState = { error: null };

type ContentMode = "link" | "file" | "html";

// Reused in two places: the portfolio Resource Hub (scoped to one trainee,
// full category picker) and the trainer's course-wide hub (traineeId null,
// category locked to whichever section it's rendered under -- see
// src/app/trainer/(hub)/resource-hub/page.tsx).
export function ResourceComposer({
  traineeId,
  centerId,
  fixedCategory,
}: {
  traineeId: string | null;
  centerId: string;
  fixedCategory?: ResourceCategory;
}) {
  const action = addResource.bind(null, traineeId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [contentMode, setContentMode] = useState<ContentMode>("link");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Only input sessions get the "interactive HTML" option -- everywhere
  // else, a self-contained live-scripted page isn't a meaningful thing to
  // attach (see build-spec.md's cork-board input-session format).
  const allowHtml = fixedCategory === "input_sessions" || fixedCategory === undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    if (contentMode === "link") {
      formData.set("content_type", "link");
      formAction(formData);
      return;
    }

    const file = formData.get("upload_file");
    if (!(file instanceof File) || file.size === 0) {
      setUploadError("Choose a file to upload.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "bin";
      const storagePath = `${centerId}/${contentMode}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("resource-hub-files")
        .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
      if (uploadErr) {
        setUploadError(`Could not upload the file: ${uploadErr.message}`);
        return;
      }
      formData.set("storage_path", storagePath);
      formData.set("content_type", contentMode);
      formData.delete("upload_file");
      formData.delete("file_url");
      formAction(formData);
      setSelectedFile(null);
      form.reset();
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="sheet flex flex-col gap-3 border-primary/25 bg-accent/30">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Add a resource</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="title"
          type="text"
          placeholder="Title"
          required
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
        {fixedCategory ? (
          <input type="hidden" name="category" value={fixedCategory} />
        ) : (
          <select
            name="category"
            defaultValue={RESOURCE_CATEGORY_ORDER[0]}
            className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          >
            {RESOURCE_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {RESOURCE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        )}
        <select
          name="resource_type"
          defaultValue={RESOURCE_TYPE_ORDER[0]}
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        >
          {RESOURCE_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {RESOURCE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["link", "file", ...(allowHtml ? (["html"] as const) : [])] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setContentMode(mode)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              contentMode === mode ? "border-primary bg-primary text-card" : "border-border text-ink trainee-hover"
            }`}
          >
            {mode === "link" ? "Link" : mode === "file" ? "Upload file" : "Upload interactive HTML"}
          </button>
        ))}
      </div>

      {contentMode === "link" ? (
        <input
          name="file_url"
          type="url"
          placeholder="Link (file, Drive, video...)"
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <input
            name="upload_file"
            type="file"
            accept={contentMode === "html" ? ".html" : undefined}
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="text-sm text-ink"
          />
          {contentMode === "html" ? (
            <p className="text-xs text-muted">
              A single self-contained .html file (its own CSS/JS inline) -- shown live in a sandboxed frame, not
              downloaded.
            </p>
          ) : null}
          {selectedFile ? <p className="text-xs text-muted">Selected: {selectedFile.name}</p> : null}
        </div>
      )}

      <textarea
        name="description"
        placeholder="Short description (optional)"
        rows={2}
        className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      <div className="flex flex-col gap-2">
        {traineeId !== null ? (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="center_wide" />
            Share across the whole center, not just this course
          </label>
        ) : (
          <input type="hidden" name="center_wide" value="on" />
        )}
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="visible_to_trainee" defaultChecked={fixedCategory !== "centre_documents"} />
          Visible to the trainee (uncheck for trainer/assessor-only material, e.g. an internal template)
        </label>
      </div>
      <div className="flex items-center justify-between">
        {state.error || uploadError ? <p className="text-sm text-destructive">{uploadError ?? state.error}</p> : null}
        <button
          type="submit"
          disabled={pending || uploading}
          className="ml-auto rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {uploading ? "Uploading…" : pending ? "Adding…" : "Add resource"}
        </button>
      </div>
    </form>
  );
}
