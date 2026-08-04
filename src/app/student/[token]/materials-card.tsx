"use client";

import { useState } from "react";

interface Material {
  id: string;
  name: string;
  url: string;
  topic: string | null;
}

// One big green card, matching the Course Stream Zoom card's visual family
// per Ramy's direction -- a preview of the most recent lesson's topic is
// always visible so it reads as "a window into what's inside," and clicking
// reveals the full list rather than showing everything at once.
export function MaterialsCard({ materials }: { materials: Material[] }) {
  const [expanded, setExpanded] = useState(false);
  const latest = materials[0];

  if (materials.length === 0) {
    return (
      <div className="rounded-xl border border-[#cfe0d2] bg-[#eaf3ec] p-6">
        <p className="text-sm font-medium text-[#3d6b4a] uppercase tracking-wide">Materials</p>
        <p className="mt-2 text-[#4a5f4e]">Nothing shared yet -- check back after your next lesson.</p>
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
      className="w-full cursor-pointer rounded-xl border border-[#cfe0d2] bg-[#eaf3ec] p-6 text-left transition-colors hover:bg-[#e0ede3]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#3d6b4a] uppercase tracking-wide">Materials</p>
          <p className="mt-1 text-lg font-semibold text-[#233d29]">
            {materials.length} {materials.length === 1 ? "file" : "files"} shared with you
          </p>
          {latest?.topic ? <p className="mt-1 line-clamp-2 text-sm text-[#4a5f4e]">Latest: {latest.topic}</p> : null}
        </div>
        <span className="mt-1 shrink-0 text-sm text-[#3d6b4a]">{expanded ? "Hide ▲" : "View all ▼"}</span>
      </div>

      {expanded ? (
        <ul className="mt-4 flex flex-col gap-2 border-t border-[#cfe0d2] pt-4">
          {materials.map((m) => (
            <li key={m.id}>
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block rounded-lg bg-white px-3 py-2 text-sm text-[#233d29] hover:underline"
              >
                <span className="block">{m.name}</span>
                {m.topic ? <span className="mt-0.5 line-clamp-1 block text-xs text-[#4a5f4e]">{m.topic}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
