"use client";

import { useState } from "react";

interface Material {
  id: string;
  name: string;
  url: string;
  topic: string | null;
}

// One big card in the app's teal family, matching the Course Stream Zoom
// card's visual family per Ramy's direction -- a preview of the most recent
// lesson's topic is always visible so it reads as "a window into what's
// inside," and clicking reveals the full list rather than showing everything
// at once.
//
// Was 7 hardcoded green hex literals with no design tokens at all (colour
// legend pass, 2026-08-21) -- rebuilt onto --color-primary (the app's teal)
// for every ink/accent role, and color-mix tints of --color-primary against
// --color-card for the background/border roles, so this card now follows
// the same token system as the rest of the app instead of a one-off green.
export function MaterialsCard({ materials }: { materials: Material[] }) {
  const [expanded, setExpanded] = useState(false);
  const latest = materials[0];

  if (materials.length === 0) {
    return (
      <div className="rounded-xl border border-[color-mix(in_oklab,var(--color-primary)_20%,var(--color-card))] bg-[color-mix(in_oklab,var(--color-primary)_8%,var(--color-card))] p-6">
        <p className="text-sm font-medium text-primary uppercase tracking-wide">Materials</p>
        <p className="mt-2 text-muted">Nothing shared yet -- check back after your next lesson.</p>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v);
      }}
      className="w-full cursor-pointer rounded-xl border border-[color-mix(in_oklab,var(--color-primary)_20%,var(--color-card))] bg-[color-mix(in_oklab,var(--color-primary)_10%,var(--color-card))] p-6 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--color-primary)_30%,var(--color-card))]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary uppercase tracking-wide">Materials</p>
          <p className="mt-1 text-lg font-semibold text-primary">
            {materials.length} {materials.length === 1 ? "file" : "files"} shared with you
          </p>
          {latest?.topic ? <p className="mt-1 line-clamp-2 text-sm text-muted">Latest: {latest.topic}</p> : null}
        </div>
        <span className="mt-1 shrink-0 text-sm text-primary">{expanded ? "Hide ▲" : "View all ▼"}</span>
      </div>

      {expanded ? (
        <ul className="mt-4 flex flex-col gap-2 border-t border-[color-mix(in_oklab,var(--color-primary)_20%,var(--color-card))] pt-4">
          {materials.map((m) => (
            <li key={m.id}>
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block rounded-lg bg-card px-3 py-2 text-sm text-primary hover:underline"
              >
                <span className="block">{m.name}</span>
                {m.topic ? <span className="mt-0.5 line-clamp-1 block text-xs text-muted">{m.topic}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
