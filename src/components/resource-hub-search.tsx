"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export interface ResourceHubSearchItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

// No design file exists for this (Resource Hub.dc.html is referenced in
// specs/design-files.md but missing from specs/handoffs/ -- flagged to
// Ramy 2026-08-18). A handful of dozens of items across half a dozen
// tables, so a typeahead that jumps to the section an item lives in --
// rather than a live in-place filter of several independently-built child
// components -- covers the same ground without touching their internals.
export function ResourceHubSearch({ items, placeholder = "Search the resource hub..." }: { items: ResourceHubSearchItem[]; placeholder?: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => i.title.toLowerCase().includes(q) || i.subtitle?.toLowerCase().includes(q)).slice(0, 12);
  }, [items, query]);

  return (
    <div className="relative">
      <div className="flex h-10 items-center gap-2 rounded-[6px] border border-input bg-card px-3 focus-within:border-primary">
        <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>
      {open && query.trim() ? (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-[6px] border border-border bg-card shadow-lg">
          {matches.length === 0 ? (
            <p className="p-3 text-sm text-muted">No matches for &ldquo;{query}&rdquo;.</p>
          ) : (
            matches.map((m) => (
              <Link
                key={m.id}
                href={m.href}
                onClick={() => setOpen(false)}
                className="block border-b border-border-faint px-3 py-2 last:border-none hover:bg-surface-muted"
              >
                <p className="text-sm text-ink">{m.title}</p>
                {m.subtitle ? <p className="text-xs text-muted">{m.subtitle}</p> : null}
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
