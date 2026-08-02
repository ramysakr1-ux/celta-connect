"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addSlidesLink,
  createMaterialRecord,
  deleteMaterial,
} from "@/app/dashboard/trainee/plan/[tpNumber]/materials-actions";
import type { Database } from "@/lib/supabase/types";

type TpMaterial = Database["public"]["Tables"]["tp_materials"]["Row"];

export function MaterialsSection({
  tpPlanId,
  centerId,
  traineeId,
  materials,
  locked,
}: {
  tpPlanId: string;
  centerId: string;
  traineeId: string;
  materials: TpMaterial[];
  locked: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [slidesUrl, setSlidesUrl] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setError("Only PDF or image files are accepted.");
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || (isPdf ? "pdf" : "png");
      const storagePath = `${centerId}/${traineeId}/${tpPlanId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("tp-materials")
        .upload(storagePath, file, { contentType: file.type });

      if (uploadError) {
        setError(`Could not upload the file: ${uploadError.message}`);
        return;
      }

      const result = await createMaterialRecord({
        tpPlanId,
        storagePath,
        fileName: file.name,
        fileType: isPdf ? "pdf" : "image",
      });
      if (result.error) setError(result.error);
    } finally {
      setUploading(false);
    }
  }

  async function handleAddSlidesLink() {
    if (!slidesUrl.trim()) return;
    setError(null);
    const result = await addSlidesLink({ tpPlanId, slidesUrl: slidesUrl.trim() });
    if (result.error) setError(result.error);
    else setSlidesUrl("");
  }

  return (
    <div className="card p-6">
      <h2 className="font-serif text-lg text-ink">Materials</h2>
      <p className="mt-1 text-sm text-muted">
        Handouts, worksheets, or slides exported as a PDF or image. Encourage Google Slides, then attach the
        exported PDF here for the bound record.
      </p>

      {materials.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-border-faint px-3 py-2 text-sm">
              <span className="text-ink">
                {m.file_name ?? m.slides_url}
                {m.file_type ? <span className="ml-2 text-xs text-muted">({m.file_type})</span> : null}
              </span>
              {!locked ? (
                <form action={deleteMaterial}>
                  <input type="hidden" name="material_id" value={m.id} />
                  <button type="submit" className="text-destructive hover:underline">
                    Remove
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No materials attached yet.</p>
      )}

      {!locked ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-border-faint pt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted">Attach materials</label>
            <input
              type="file"
              accept="application/pdf,image/*"
              disabled={uploading}
              onChange={handleFileChange}
              className="text-sm text-ink"
            />
            {uploading ? <p className="text-sm text-muted">Uploading…</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={slidesUrl}
              onChange={(e) => setSlidesUrl(e.target.value)}
              placeholder="Optional: live Google Slides link"
              className="flex-1 rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleAddSlidesLink}
              className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
            >
              Add link
            </button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
