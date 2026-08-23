"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createMaterialRecord, deleteMaterial } from "@/app/dashboard/trainee/plan/[tpNumber]/materials-actions";
import { DriveAttachButtons } from "@/app/dashboard/trainee/plan/[tpNumber]/drive-attach-buttons";
import type { Database } from "@/lib/supabase/types";

type TpMaterial = Database["public"]["Tables"]["tp_materials"]["Row"];

export function MaterialsSection({
  tpPlanId,
  centerId,
  traineeId,
  materials,
  locked,
  hasGoogleConnection,
}: {
  tpPlanId: string;
  centerId: string;
  traineeId: string;
  materials: TpMaterial[];
  locked: boolean;
  hasGoogleConnection: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  async function handleOpenMaterial(m: TpMaterial) {
    if (m.slides_url) {
      window.open(m.slides_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!m.storage_path) return;

    // Open the tab synchronously on the click, then point it at the signed
    // URL once it resolves -- opening a new tab only after an awaited call
    // gets blocked as a popup by most browsers.
    const tab = window.open("", "_blank");
    setOpening(m.id);
    try {
      const supabase = createClient();
      const { data, error: signError } = await supabase.storage
        .from("tp-materials")
        .createSignedUrl(m.storage_path, 60);
      if (signError || !data) {
        tab?.close();
        setError("Could not open the file. Try again.");
        return;
      }
      if (tab) tab.location.href = data.signedUrl;
    } finally {
      setOpening(null);
    }
  }

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

  return (
    <div className="card rounded-[9px] border-t-[var(--trainee-plum)] p-6">
      <h2 className="font-serif text-lg text-ink">Materials</h2>
      <p className="mt-1 text-sm text-muted">
        Handouts, worksheets, or slides. Upload a PDF/image{hasGoogleConnection ? ", or attach a file directly from your centre's Drive" : ""}.
      </p>

      {materials.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-border-faint px-3 py-2 text-sm">
              <button
                type="button"
                onClick={() => handleOpenMaterial(m)}
                disabled={opening === m.id}
                className="text-left text-ink hover:underline disabled:opacity-60"
              >
                {opening === m.id ? "Opening…" : (m.file_name ?? m.slides_url)}
                {m.file_type ? <span className="ml-2 text-xs text-muted">({m.file_type})</span> : null}
              </button>
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
          {hasGoogleConnection ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-muted">Or attach a Google Doc, Slides, or Sheet</label>
              <DriveAttachButtons tpPlanId={tpPlanId} onError={setError} />
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
