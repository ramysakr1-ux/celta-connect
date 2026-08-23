"use client";

import { useState } from "react";
import { toggleAssessorSelection } from "@/app/trainer/assessor-actions";

// for-claude-code-assessor-pack-decisions.md §1: "Centres need a way to
// mark which candidates are 'selected for this visit'." Kept out of the
// roster table itself (for-claude-code-roster-column-crowding.md already
// fought to keep that lean, and this is a rare, occasional task, not a
// permanent column) -- a small expandable checklist next to the assessor
// pack link instead, since that's already where assessor-facing controls
// live on this page.
export function AssessorSelectionButton({ candidates }: { candidates: { id: string; name: string; selected: boolean }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary"
      >
        Select for assessor visit
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-72 rounded-[8px] border border-border bg-card p-3 shadow-lg">
          <p className="mb-2 text-xs text-muted">
            Who the assessor sees by default. Everyone stays reachable either way — this only sets what&apos;s
            featured on their landing page.
          </p>
          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
            {candidates.map((c) => (
              <CandidateToggle key={c.id} id={c.id} name={c.name} initialSelected={c.selected} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CandidateToggle({ id, name, initialSelected }: { id: string; name: string; initialSelected: boolean }) {
  const [selected, setSelected] = useState(initialSelected);

  return (
    <form
      action={toggleAssessorSelection}
      onChange={(e) => e.currentTarget.requestSubmit()}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="trainee_id" value={id} />
      <input type="hidden" name="selected" value={selected ? "false" : "true"} />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={selected} onChange={() => setSelected((v) => !v)} />
        {name}
      </label>
    </form>
  );
}
