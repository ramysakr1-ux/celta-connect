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

  // On the owner's own screen the branches stop being a filter control and
  // start being the thing the screen is about. Ramy, 1 Sep 2026: "it should
  // be a sign of wealth. The centre owner is proud of their centres, so it
  // kind of needs to pop a bit." Same buttons, same behaviour -- read at
  // reading size, in the serif, on the garnet the rest of that screen uses,
  // and named, so the row says whose centres these are.
  const proud = pathname === "/centre/owner" || pathname.startsWith("/centre/owner/");

  const set = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("branch", id);
    else next.delete("branch");
    router.push(`${pathname}?${next.toString()}`);
  };

  if (proud) {
    const garnet = "oklch(42% 0.15 27)";
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] font-bold tracking-[0.16em] text-muted uppercase">Your centres</span>
        {[{ id: null as string | null, name: "All branches" }, ...branches.map((b) => ({ id: b.id, name: b.name }))].map((b) => {
          const isActive = b.id === null ? !current : current === b.id;
          return (
            <button
              key={b.id ?? "all"}
              type="button"
              onClick={() => set(b.id)}
              className="rounded-[4px] border px-3.5 py-1.5 font-serif text-[13.5px] transition-colors duration-150"
              style={
                isActive
                  ? { background: garnet, borderColor: garnet, color: "oklch(98% 0.006 85)" }
                  : { borderColor: "oklch(85% 0.018 75)", color: "oklch(38% 0.02 60)" }
              }
            >
              {b.name}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => set(null)}
        className={`rounded-[5px] px-2.5 py-1 text-[11px] font-semibold ${
          !current ? "bg-primary text-primary-foreground" : "admin-hover-fill text-muted hover:text-ink"
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
          className={`rounded-[5px] px-2.5 py-1 text-[11px] font-semibold ${
            current === b.id ? "bg-primary text-primary-foreground" : "admin-hover-fill text-muted hover:text-ink"
          }`}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
