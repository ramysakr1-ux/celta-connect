"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Upload, Link2, HardDrive, X } from "lucide-react";
import { addSlidesLink } from "@/app/dashboard/trainee/plan/[tpNumber]/materials-actions";
import { DriveAttachButtons } from "@/app/dashboard/trainee/plan/[tpNumber]/drive-attach-buttons";

// Ramy, 12 Sep 2026: "why not just choose file inside a pill... You should be
// able to click on the pill, and then it opens options -- link, upload,
// drive -- with little icons for each one. When you click on upload, it gives
// you the option to drag and drop or browse. Like Google Classroom."
//
// What this replaces: a bare <input type="file">, which is where "Choose file
// / No file chosen" came from, sitting above a separate labelled Drive button
// on its own line -- two controls that looked like two unrelated features
// rather than two ways to do one thing.
//
// Create (a new Google Doc from inside Connect) is deliberately not here: it
// needs write access to the centre's Drive and a decision about whose Drive
// the file lands in. The three below are the ways material actually arrives.

type Mode = null | "menu" | "upload" | "link";

export function AttachMenu({
  tpPlanId,
  hasGoogleConnection,
  uploading,
  onFile,
  onError,
}: {
  tpPlanId: string;
  hasGoogleConnection: boolean;
  uploading: boolean;
  /** Hands the chosen file to MaterialsSection, which owns the upload. */
  onFile: (file: File) => void;
  onError: (message: string | null) => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [dragging, setDragging] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "menu") return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setMode(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMode(null);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [mode]);

  const take = (file: File | undefined | null) => {
    if (!file) return;
    setMode(null);
    onFile(file);
  };

  async function saveLink(e: React.FormEvent) {
    e.preventDefault();
    const url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      onError("A link needs to start with http:// or https://");
      return;
    }
    setSavingLink(true);
    onError(null);
    try {
      const res = await addSlidesLink({ tpPlanId, slidesUrl: url, fileName: linkName.trim() || url });
      if (res.error) onError(res.error);
      else {
        setLinkUrl("");
        setLinkName("");
        setMode(null);
      }
    } finally {
      setSavingLink(false);
    }
  }

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-card-inset";

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setMode(mode === null ? "menu" : null)}
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
        style={{ background: "var(--color-primary)" }}
      >
        <Paperclip size={15} />
        {uploading ? "Attaching…" : "Attach"}
      </button>

      {mode === "menu" ? (
        <div
          role="menu"
          className="absolute left-0 top-12 z-40 w-[240px] rounded-[10px] border border-border bg-card p-1.5 shadow-[0_10px_30px_oklch(23.5%_0.017_65_/_0.18)]"
        >
          <button type="button" role="menuitem" className={itemClass} onClick={() => setMode("upload")}>
            <Upload size={16} className="text-muted" />
            <span>
              Upload a file
              <span className="block text-[11px] text-muted">PDF, Word, PowerPoint or an image</span>
            </span>
          </button>
          <button type="button" role="menuitem" className={itemClass} onClick={() => setMode("link")}>
            <Link2 size={16} className="text-muted" />
            <span>
              Paste a link
              <span className="block text-[11px] text-muted">Anything with a web address</span>
            </span>
          </button>
          {hasGoogleConnection ? (
            <div className="mt-0.5 border-t border-border-faint pt-1.5">
              <div className="flex items-center gap-2.5 px-3 py-1">
                <HardDrive size={16} className="text-muted" />
                <span className="text-sm text-ink">From your centre&apos;s Drive</span>
              </div>
              <div className="px-3 pb-1.5">
                <DriveAttachButtons tpPlanId={tpPlanId} onError={onError} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "upload" ? (
        <div className="mt-3 rounded-[10px] border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Upload a file</p>
            <button type="button" onClick={() => setMode(null)} aria-label="Close" className="text-muted hover:text-ink">
              <X size={15} />
            </button>
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              take(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInput.current?.click()}
            className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed px-4 py-8 text-center transition-colors"
            style={{
              borderColor: dragging ? "var(--color-primary)" : "var(--color-border)",
              background: dragging ? "color-mix(in oklab, var(--color-primary) 8%, var(--color-card))" : "transparent",
            }}
          >
            <Upload size={20} className="text-muted" />
            <p className="text-sm text-ink">Drag a file here</p>
            <p className="text-xs text-muted">or click to browse</p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,image/*,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              take(f);
            }}
          />
        </div>
      ) : null}

      {mode === "link" ? (
        <form onSubmit={saveLink} className="mt-3 flex flex-col gap-2.5 rounded-[10px] border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Paste a link</p>
            <button type="button" onClick={() => setMode(null)} aria-label="Close" className="text-muted hover:text-ink">
              <X size={15} />
            </button>
          </div>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="h-9 rounded-[8px] border border-input bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
          />
          <input
            type="text"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="What is it? (optional)"
            className="h-9 rounded-[8px] border border-input bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={savingLink || !linkUrl.trim()}
            className="self-start rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            style={{ background: "var(--color-primary)" }}
          >
            {savingLink ? "Attaching…" : "Attach link"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
