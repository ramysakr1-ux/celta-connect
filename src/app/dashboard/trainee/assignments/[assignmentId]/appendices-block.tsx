"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  attachAppendix,
  removeAppendix,
  appendixDownloadUrl,
} from "@/app/dashboard/trainee/assignments/[assignmentId]/appendix-actions";
import { APPENDIX_BUCKET } from "@/lib/assignment-appendices";
import { BORDER, INK, MUTED, SHEET, TEAL, GOLD_INK } from "@/components/tp-sheet";

// Migration 0302. The Focus on the Learner brief tells the candidate, in two
// of its five sections, to "Attach one task in Appendix 1" and "Appendix 2";
// the Skills assignment is analysis of a text. Until now the Appendices
// heading was a sentence with nothing under it.
//
// The file goes browser -> Storage directly (1MB Server Action body cap), and
// only the metadata row comes back through an action, exactly as TP materials
// do. A link is the second door, for a centre that keeps worksheets on Drive.

export interface AppendixRow {
  id: string;
  label: string | null;
  file_name: string;
  storage_path: string | null;
  link_url: string | null;
  size_bytes: number | null;
}

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx,.mp3,.m4a,.wav";
const MAX_BYTES = 25 * 1024 * 1024;

function sizeLabel(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AppendicesBlock({
  assignmentId,
  round,
  centerId,
  traineeId,
  appendices,
  readOnly,
  hint,
}: {
  assignmentId: string;
  round: "first" | "resubmission";
  centerId: string;
  traineeId: string;
  appendices: AppendixRow[];
  readOnly: boolean;
  hint: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startRefresh] = useTransition();

  // The brief numbers them, so an unlabelled attachment takes the next number.
  const nextLabel = () => label.trim() || `Appendix ${appendices.length + 1}`;

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      setError("That file is over 25 MB. Scan at a lower resolution, or attach it as a link.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "bin";
      // {center}/{trainee}/{assignment}/... -- the storage policies read the
      // first two folders, so this shape is not cosmetic.
      const storagePath = `${centerId}/${traineeId}/${assignmentId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(APPENDIX_BUCKET)
        .upload(storagePath, file, { contentType: file.type });
      if (uploadError) {
        setError(`Could not upload that: ${uploadError.message}`);
        return;
      }
      const result = await attachAppendix({
        assignmentId,
        round,
        label: nextLabel(),
        storagePath,
        fileName: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size,
      });
      if (result.error) setError(result.error);
      else {
        setLabel("");
        startRefresh(() => router.refresh());
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleLink() {
    const url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setError("A link has to start with http:// or https://");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await attachAppendix({
        assignmentId,
        round,
        label: nextLabel(),
        linkUrl: url,
        fileName: url.replace(/^https?:\/\//i, "").slice(0, 80),
      });
      if (result.error) setError(result.error);
      else {
        setLinkUrl("");
        setLabel("");
        setAddingLink(false);
        startRefresh(() => router.refresh());
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen(row: AppendixRow) {
    if (row.link_url) {
      window.open(row.link_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!row.storage_path) return;
    const { url, error: e } = await appendixDownloadUrl(row.storage_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setError(e);
  }

  async function handleRemove(row: AppendixRow) {
    setBusy(true);
    try {
      const result = await removeAppendix({ appendixId: row.id, assignmentId });
      if (result.error) setError(result.error);
      else startRefresh(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2" style={{ marginLeft: 12 }}>
      <p className="italic" style={{ fontSize: "var(--text-label)", color: MUTED }}>
        {hint}
      </p>

      {appendices.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {appendices.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2"
              style={{ borderRadius: 7, border: `1px solid ${BORDER}`, background: SHEET, padding: "7px 10px" }}
            >
              <button
                type="button"
                onClick={() => handleOpen(row)}
                className="flex min-w-0 flex-1 flex-col items-start text-left"
              >
                <span style={{ fontSize: "var(--text-meta)", fontWeight: 700, color: TEAL }}>{row.label ?? "Appendix"}</span>
                <span className="w-full truncate" style={{ fontSize: "var(--text-label)", color: INK }}>
                  {row.file_name}
                  {row.link_url ? " · link" : row.size_bytes ? ` · ${sizeLabel(row.size_bytes)}` : ""}
                </span>
              </button>
              {readOnly ? null : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleRemove(row)}
                  aria-label={`Remove ${row.label ?? row.file_name}`}
                  style={{ fontSize: "var(--text-meta)", color: MUTED, padding: "0 4px" }}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {readOnly ? (
        appendices.length === 0 ? (
          <p className="italic" style={{ fontSize: "var(--text-label)", color: MUTED }}>
            Nothing attached.
          </p>
        ) : null
      ) : (
        <div className="flex flex-col gap-1.5">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`Name it — defaults to "Appendix ${appendices.length + 1}"`}
            style={{
              borderRadius: 7,
              border: `1px solid ${BORDER}`,
              background: SHEET,
              padding: "6px 10px",
              fontSize: "var(--text-meta)",
              color: INK,
              outline: "none",
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              style={{
                borderRadius: 7,
                border: `1px solid ${TEAL}`,
                background: "transparent",
                padding: "6px 12px",
                fontSize: "var(--text-meta)",
                fontWeight: 600,
                color: TEAL,
              }}
            >
              {busy ? "Attaching…" : "Attach a file"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAddingLink((v) => !v)}
              style={{ fontSize: "var(--text-meta)", color: MUTED, textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              or a link
            </button>
          </div>
          {addingLink ? (
            <div className="flex items-center gap-2">
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                style={{
                  flex: 1,
                  borderRadius: 7,
                  border: `1px solid ${BORDER}`,
                  background: SHEET,
                  padding: "6px 10px",
                  fontSize: "var(--text-meta)",
                  color: INK,
                  outline: "none",
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleLink()}
                style={{ borderRadius: 7, background: TEAL, padding: "6px 12px", fontSize: "var(--text-meta)", fontWeight: 600, color: SHEET }}
              >
                Add
              </button>
            </div>
          ) : null}
          <p className="italic" style={{ fontSize: "var(--text-label)", color: MUTED }}>
            PDF, image, Word, PowerPoint or audio, up to 25 MB. Not counted in the word count.
          </p>
        </div>
      )}

      {error ? <p style={{ fontSize: "var(--text-label)", color: GOLD_INK }}>{error}</p> : null}
    </div>
  );
}
