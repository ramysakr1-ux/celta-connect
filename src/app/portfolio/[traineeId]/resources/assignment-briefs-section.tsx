"use client";

import { useState } from "react";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import type { AssignmentTypeValue, TemplateSection } from "@/lib/assignment-templates/content";

interface BriefRow {
  id: string;
  assignment_type: AssignmentTypeValue;
  sections: TemplateSection[];
  published_at: string | null;
}

function BriefCard({ brief }: { brief: BriefRow }) {
  const [open, setOpen] = useState(false);
  const info = ASSIGNMENT_INFO[brief.assignment_type];

  return (
    <li className="sheet trainee-hover flex flex-col gap-2 p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-left text-sm font-semibold text-ink hover:text-primary">
        {info?.title ?? brief.assignment_type} {open ? "▾" : "→"}
      </button>
      {open ? (
        <div className="mt-1 flex flex-col gap-3">
          {brief.sections.map((s) => (
            <div key={s.key}>
              <p className="text-xs font-semibold text-ink">{s.title}</p>
              <p className="mt-0.5 whitespace-pre-line text-xs text-muted">{s.instruction}</p>
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

// Read-only browse of the published brief content (parsed sections, never
// the raw uploaded PDF -- specs/build-spec.md's "parsed into templates...
// the source file is finished after import, never re-served").
export function AssignmentBriefsSection({ briefs }: { briefs: BriefRow[] }) {
  if (briefs.length === 0) return null;

  return (
    <div>
      <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">Assignment Briefs</h3>
      <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {briefs.map((brief) => (
          <BriefCard key={brief.id} brief={brief} />
        ))}
      </ul>
    </div>
  );
}
