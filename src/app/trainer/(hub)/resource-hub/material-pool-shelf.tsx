"use client";

import { useActionState } from "react";
import { uploadMaterialPoolItem, deleteMaterialPoolItem, type MaterialPoolState } from "./material-pool-actions";

const initial: MaterialPoolState = { error: null };

export interface MaterialPoolItemView {
  id: string;
  bookTitle: string;
  level: string | null;
  description: string | null;
  isBaseline: boolean;
  signedUrl: string | null;
  claimedByLabel: string | null; // set when claimed somewhere this course, for trainer visibility
}

// connect-spec-corrections-for-claude-code.md item 6: baseline library
// (platform-provided) alongside whatever this centre has added itself.
// Trainer-facing -- upload/remove the centre's own scans; candidates claim
// from the read-only mirror of this same pool on their Resources tab.
export function MaterialPoolShelf({ items }: { items: MaterialPoolItemView[] }) {
  const [state, action, pending] = useActionState(uploadMaterialPoolItem, initial);
  const baseline = items.filter((i) => i.isBaseline);
  const own = items.filter((i) => !i.isBaseline);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        For TP7/8, deliberately not the course coursebook. A candidate claims one item per group -- once claimed,
        nobody else in the same TP group can plan around it too.
      </p>

      {baseline.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Baseline library</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {baseline.map((item) => (
              <ItemCard key={item.id} item={item} removable={false} />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">This centre&apos;s own scans</p>
        {own.length > 0 ? (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {own.map((item) => (
              <ItemCard key={item.id} item={item} removable />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">Nothing added yet.</p>
        )}
      </div>

      <form action={action} className="flex flex-col gap-2 rounded-[6px] border border-border p-3">
        <label className="text-sm text-muted">Add a scan</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="book_title"
            type="text"
            placeholder="Book title"
            required
            className="h-8 min-w-[160px] flex-1 rounded-[6px] border border-input bg-card px-2 text-xs text-ink outline-none focus:border-primary"
          />
          <input
            name="level"
            type="text"
            placeholder="Level, e.g. B1"
            className="h-8 w-24 rounded-[6px] border border-input bg-card px-2 text-xs text-ink outline-none focus:border-primary"
          />
        </div>
        <input
          name="description"
          type="text"
          placeholder="Note (optional)"
          className="h-8 rounded-[6px] border border-input bg-card px-2 text-xs text-ink outline-none focus:border-primary"
        />
        <div className="flex items-center gap-2">
          <input type="file" name="file" accept="application/pdf,image/*" required className="text-xs text-muted" />
          <button
            type="submit"
            disabled={pending}
            className="h-8 shrink-0 rounded-[6px] bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      </form>
    </div>
  );
}

function ItemCard({ item, removable }: { item: MaterialPoolItemView; removable: boolean }) {
  return (
    <div className="rounded-[6px] border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">
            {item.bookTitle}
            {item.level ? <span className="ml-1.5 text-xs font-normal text-muted">{item.level}</span> : null}
          </p>
          {item.description ? <p className="mt-0.5 text-xs text-muted">{item.description}</p> : null}
          {item.claimedByLabel ? <p className="mt-1 text-xs text-status-warning-text">Claimed -- {item.claimedByLabel}</p> : null}
        </div>
        {item.signedUrl ? (
          <a href={item.signedUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-semibold text-primary hover:underline">
            Open →
          </a>
        ) : null}
      </div>
      {removable ? (
        <form action={deleteMaterialPoolItem} className="mt-2">
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" className="text-xs text-destructive hover:underline">
            Remove
          </button>
        </form>
      ) : null}
    </div>
  );
}
