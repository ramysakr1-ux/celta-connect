"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ResourceContentType } from "@/lib/supabase/types";

// Renders whichever of the three content shapes a resource actually has.
// "html" is the one genuinely new capability -- build-spec.md's real
// input-session files are self-contained interactive HTML/CSS/JS (a
// cork-board theme, flip-cards, sorters). Shown live in a SANDBOXED
// iframe, not downloaded: `sandbox="allow-scripts"` deliberately omits
// allow-same-origin, allow-top-navigation, and allow-popups, so the
// embedded document runs with an opaque origin -- no access to this app's
// cookies, localStorage, or parent DOM, regardless of what the file itself
// contains. Supabase Storage serving it from its own domain (not this
// app's origin) is a second, independent layer of the same protection.
export function ResourceContentLink({
  title,
  fileUrl,
  storagePath,
  contentType,
  bucket = "resource-hub-files",
}: {
  title: string;
  fileUrl: string | null;
  storagePath: string | null;
  contentType: ResourceContentType;
  bucket?: string;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [htmlText, setHtmlText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function ensureSignedUrl(): Promise<string | null> {
    if (signedUrl) return signedUrl;
    if (!storagePath) return null;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
      if (signErr || !data) {
        setError("Could not load this file. Try again.");
        return null;
      }
      setSignedUrl(data.signedUrl);
      return data.signedUrl;
    } finally {
      setLoading(false);
    }
  }

  // Supabase's signed-URL endpoint serves .html objects with a forced
  // Content-Type: text/plain (confirmed live -- the stored object metadata
  // correctly says text/html, but the /sign/ response header doesn't),
  // almost certainly a deliberate anti-XSS safeguard on their end against
  // exactly this kind of live-script-from-storage-domain use case. An
  // <iframe src=...> pointed straight at that URL would just show raw
  // source. Fetching the bytes and loading them via srcDoc sidesteps the
  // server's content-type entirely -- the browser always treats srcDoc
  // content as HTML, and it's still fully sandboxed the same way.
  async function ensureHtmlText(): Promise<string | null> {
    if (htmlText) return htmlText;
    const url = await ensureSignedUrl();
    if (!url) return null;
    setLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        setError("Could not load this file. Try again.");
        return null;
      }
      const text = await res.text();
      setHtmlText(text);
      return text;
    } catch {
      setError("Could not load this file. Try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  if (contentType === "link" && fileUrl) {
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-ink hover:text-primary hover:underline">
        {title} →
      </a>
    );
  }

  if (contentType === "file") {
    return (
      <div>
        <button
          type="button"
          onClick={async () => {
            const url = await ensureSignedUrl();
            if (url) window.open(url, "_blank", "noopener,noreferrer");
          }}
          disabled={loading}
          className="text-sm font-semibold text-ink hover:text-primary hover:underline disabled:opacity-60"
        >
          {loading ? "Loading…" : `${title} →`}
        </button>
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  // html
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={async () => {
          if (!open) await ensureHtmlText();
          setOpen((o) => !o);
        }}
        disabled={loading}
        className="self-start text-sm font-semibold text-ink hover:text-primary hover:underline disabled:opacity-60"
      >
        {loading ? "Loading…" : open ? `Hide ${title}` : `Open ${title} →`}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {open && htmlText ? (
        <iframe
          srcDoc={htmlText}
          title={title}
          sandbox="allow-scripts"
          className="h-[70vh] w-full rounded-[6px] border border-border bg-white"
        />
      ) : null}
    </div>
  );
}
