"use client";

import { useActionState } from "react";
import { claimMaterialItem, releaseMaterialClaim, type ClaimState } from "./material-pool-actions";

const initial: ClaimState = { error: null };

export interface MaterialPoolItemForTrainee {
  id: string;
  bookTitle: string;
  level: string | null;
  description: string | null;
  isBaseline: boolean;
  signedUrl: string | null;
  claimedByOther: boolean;
  claimedByMe: { id: string; tpNumber: 7 | 8 } | null;
}

// connect-spec-corrections-for-claude-code.md item 6: "candidates browse
// the pool and pick/claim... for their TP7 or TP8 lesson." First-come --
// claiming reserves it for the whole TP group, both numbers, until
// released.
export function MaterialPoolSection({ items, canClaim }: { items: MaterialPoolItemForTrainee[]; canClaim: boolean }) {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">TP7/8 material pool</h3>
      <p className="mt-1 text-xs text-muted">
        Deliberately not the course coursebook. Claim one for TP7 and one for TP8 -- once claimed, nobody else in
        your TP group can plan around the same material.
      </p>
      <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} canClaim={canClaim} />
        ))}
      </ul>
    </div>
  );
}

function ItemCard({ item, canClaim }: { item: MaterialPoolItemForTrainee; canClaim: boolean }) {
  const [state, action, pending] = useActionState(claimMaterialItem, initial);
  const unavailable = item.claimedByOther;

  return (
    <li className="sheet flex flex-col gap-2 p-4">
      <p className="text-sm font-semibold text-ink">
        {item.bookTitle}
        {item.level ? <span className="ml-1.5 text-xs font-normal text-muted">{item.level}</span> : null}
      </p>
      {item.description ? <p className="text-xs text-muted">{item.description}</p> : null}
      {item.signedUrl ? (
        <a href={item.signedUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">
          Open →
        </a>
      ) : null}

      {item.claimedByMe ? (
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs text-primary">Claimed for TP{item.claimedByMe.tpNumber}</span>
          <form action={releaseMaterialClaim}>
            <input type="hidden" name="id" value={item.claimedByMe.id} />
            <button type="submit" className="text-xs text-destructive hover:underline">
              Release
            </button>
          </form>
        </div>
      ) : unavailable ? (
        <p className="mt-1 text-xs text-muted">Already claimed in your TP group.</p>
      ) : canClaim ? (
        <form action={action} className="mt-1 flex items-center gap-2">
          <input type="hidden" name="material_item_id" value={item.id} />
          <select
            name="tp_number"
            defaultValue="7"
            className="h-7 rounded-[6px] border border-input bg-card-inset px-1.5 text-xs text-ink outline-none focus:border-primary"
          >
            <option value="7">TP7</option>
            <option value="8">TP8</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="h-7 rounded-[6px] border border-dashed border-status-warning-text px-2.5 text-xs font-medium text-status-warning-text hover:bg-status-warning-bg disabled:opacity-60"
          >
            {pending ? "Claiming…" : "Claim"}
          </button>
        </form>
      ) : null}
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </li>
  );
}
