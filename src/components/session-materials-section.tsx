"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createSessionMaterial, deleteSessionMaterial } from "@/lib/session-materials-actions";
import type { TpMaterialFileType } from "@/lib/supabase/types";

export interface SessionMaterial {
  id: string;
  file_name: string | null;
  file_type: TpMaterialFileType | null;
  storage_path: string | null;
  slides_url: string | null;
  uploaded_by: string;
}

// Shared by the trainee's GTKY page and the trainer's session-materials
// page -- same upload widget as MaterialsSection (dashboard/trainee/plan/
// [tpNumber]/materials-section.tsx), re-pointed at session_materials
// instead of tp_materials since neither GTKY nor a trainer-taught session
// has a tp_plans row to hang off. `canManage` covers only the current
// viewer's OWN uploads (RLS enforces this too; this just hides the
// Remove control for material someone else on the same session shared).
export function SessionMaterialsSection({
  timetableEventId,
  courseId,
  viewerId,
  materials,
  revalidatePath,
}: {
  timetableEventId: string;
  courseId: string;
  viewerId: string;
  materials: SessionMaterial[];
  revalidatePath: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  async function handleOpenMaterial(m: SessionMaterial) {
    if (m.slides_url) {
      window.open(m.slides_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!m.storage_path) return;
    const tab = window.open("", "_blank");
    setOpening(m.id);
    try {
      const supabase = createClient();
      const { data, error: signError } = await supabase.storage.from("tp-materials").createSignedUrl(m.storage_path, 60);
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
    const isPptx = file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || file.type === "application/vnd.ms-powerpoint";
    const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.type === "application/msword";
    if (!isPdf && !isImage && !isPptx && !isDocx) {
      setError("Only PDF, PowerPoint, Word, or image files are accepted.");
      return;
    }
    const fileType: TpMaterialFileType = isPdf ? "pdf" : isPptx ? "pptx" : isDocx ? "docx" : "image";

    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || fileType;
      const storagePath = `${courseId}/session/${timetableEventId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("tp-materials").upload(storagePath, file, { contentType: file.type });
      if (uploadError) {
        setError(`Could not upload the file: ${uploadError.message}`);
        return;
      }

      const result = await createSessionMaterial({
        timetableEventId,
        courseId,
        storagePath,
        fileName: file.name,
        fileType,
        revalidate: revalidatePath,
      });
      if (result.error) setError(result.error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {materials.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-border-faint px-3 py-2 text-sm">
              <button type="button" onClick={() => handleOpenMaterial(m)} disabled={opening === m.id} className="text-left text-ink hover:underline disabled:opacity-60">
                {opening === m.id ? "Opening…" : (m.file_name ?? m.slides_url)}
                {m.file_type ? <span className="ml-2 text-xs text-muted">({m.file_type})</span> : null}
              </button>
              {m.uploaded_by === viewerId ? (
                <form action={deleteSessionMaterial}>
                  <input type="hidden" name="material_id" value={m.id} />
                  <input type="hidden" name="revalidate" value={revalidatePath} />
                  <button type="submit" className="text-destructive hover:underline">
                    Remove
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nothing shared yet.</p>
      )}

      <div className="flex flex-col gap-1.5 border-t border-border-faint pt-3">
        <label className="text-sm text-muted">Attach materials</label>
        <input
          type="file"
          accept="application/pdf,image/*,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          disabled={uploading}
          onChange={handleFileChange}
          className="text-sm text-ink"
        />
        {uploading ? <p className="text-sm text-muted">Uploading…</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
