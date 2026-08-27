"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export interface Branch {
  id: string;
  name: string;
  centerNumber: string | null;
}

/**
 * build-spec.md §13: "**A filter, not a switcher.** Switching context means
 * re-orienting on every move; filtering keeps one page and narrows it on
 * demand."
 *
 * This replaces the centre switcher built earlier the same day, which did
 * exactly what that sentence rejects -- it set an active centre and re-scoped
 * the whole page, so every move meant working out which branch you were in.
 *
 * The filter narrows a page that shows everything by default. It lives in the
 * URL rather than on the profile, because it's a view preference: two tabs can
 * hold different filters, and nothing about the person changes.
 *
 * Hidden entirely for a single-branch centre -- "a single-centre customer never
 * sees it."
 */
export function BranchFilter({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("branch");

  if (branches.length < 2) return null;

  const set = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("branch", id);
    else next.delete("branch");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => set(null)}
        className={`admin-hover-fill rounded-[5px] px-2.5 py-1 text-[11px] font-semibold ${
          !current ? "bg-primary text-primary-foreground" : "text-muted hover:text-ink"
        }`}
      >
        All branches
      </button>
      {branches.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => set(b.id)}
          // The centre number rides along in the title because "IT059" is
          // ambiguous across two cities.
          title={b.centerNumber ? `${b.name} · ${b.centerNumber}` : b.name}
          className={`admin-hover-fill rounded-[5px] px-2.5 py-1 text-[11px] font-semibold ${
            current === b.id ? "bg-primary text-primary-foreground" : "text-muted hover:text-ink"
          }`}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
