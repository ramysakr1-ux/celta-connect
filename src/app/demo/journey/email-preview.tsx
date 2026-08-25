"use client";

import { useState } from "react";

// Ramy, 25 Aug 2026: "it's really really slow... is there any way to make
// this presentation faster?" -- 13 email previews on one page, each a live
// iframe, all rendering the instant the page loaded regardless of whether
// any single one was ever going to be shown. Collapsed by default so the
// page itself is light -- the iframe doesn't even mount until "Show email"
// is clicked, which is also exactly the rhythm of presenting this live:
// open the one you're talking about, not all thirteen at once.
export function EmailPreview({ title, to, html }: { title: string; to: string; html: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted">
          {title} <span className="font-normal">&middot; to {to}</span>
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="admin-hover-fill shrink-0 rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-ink"
        >
          {open ? "Hide email" : "Show email"}
        </button>
      </div>
      {open ? <iframe srcDoc={html} title={title} className="h-[340px] w-full rounded-[8px] border border-border bg-white" /> : null}
    </div>
  );
}
