"use client";

import { useState } from "react";

/** Copies the absolute demo URL, so it can be pasted into a private window. */
export function CopyDemoLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          // A browser refusing the clipboard is not worth an error state --
          // the address bar still has the link.
          setCopied(false);
        }
      }}
      className="wash inline-flex h-10 items-center rounded-[8px] border border-border px-4 text-body font-medium text-ink"
    >
      {copied ? "Link copied" : "Copy link for a private window"}
    </button>
  );
}
