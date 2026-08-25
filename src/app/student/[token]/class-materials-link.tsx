"use client";

import { useState } from "react";

interface Material {
  id: string;
  name: string;
  url: string;
}

// volunteer-view-full-spec.md: "Materials link (12px weight 600 teal) shown
// only if hasMaterials" -- the mockup only ever shows one link per class row
// ("3 handouts"), no dropdown chrome drawn. A class can have more than one
// file though, so a single link can't point anywhere when count > 1 --
// reuses the same click-to-expand interaction MaterialsCard already used
// for its own multi-file case, scoped down to a small inline popover
// instead of a whole card.
export function ClassMaterialsLink({ materials }: { materials: Material[] }) {
  const [open, setOpen] = useState(false);
  if (materials.length === 0) return null;

  if (materials.length === 1) {
    return (
      <a href={materials[0].url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
        1 handout
      </a>
    );
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-primary hover:underline">
        {materials.length} handouts
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-1.5 flex w-48 flex-col gap-1 rounded-[8px] border border-border bg-card p-2 shadow-lg">
          {materials.map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate rounded-[6px] px-2 py-1.5 text-left text-xs text-ink admin-hover-fill"
            >
              {m.name}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
