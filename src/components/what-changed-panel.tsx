import type { RecentChange } from "@/lib/what-changed";

export function WhatChangedPanel({ changes }: { changes: RecentChange[] }) {
  return (
    <div className="card p-4">
      <h2 className="font-serif text-sm text-ink">What changed</h2>
      {changes.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Nothing recent.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {changes.map((c, i) => (
            <li key={i} className="text-xs text-muted">
              <span className="text-ink">{c.label}</span> &middot; {c.createdAt.slice(0, 10)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
