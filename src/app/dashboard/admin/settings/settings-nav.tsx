"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// "Left rail nav: Centre profile, Google Drive, Assignment briefs, Feedback
// style, Tutors — active item has a colored left rule and a red dot flag if
// something there needs attention."
//
// The dot is computed from real state on the server, never decorative: a flag
// that is sometimes wrong is worse than no flag, because people stop trusting
// it and then miss the one that mattered.

export interface SettingsNavItem {
  href: string;
  label: string;
  external?: boolean;
  /** Something in that section needs doing. Reason shown on hover. */
  needsAttention?: string | null;
}

export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.href ?? null);

  // Which section is actually on screen. IntersectionObserver rather than a
  // scroll handler: no per-frame work, and it stays correct when a section is
  // reached by anchor click rather than by scrolling.
  useEffect(() => {
    const anchors = items.filter((i) => !i.external && i.href.startsWith("#"));
    const nodes = anchors
      .map((i) => document.getElementById(i.href.slice(1)))
      .filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(`#${visible.target.id}`);
      },
      // Bias to the upper part of the viewport, so the heading you are reading
      // is the one marked rather than whatever happens to be lowest.
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="sticky top-4 flex flex-col gap-0.5 rounded-[6px] border border-border bg-card py-3.5">
      <p className="px-4 pb-2 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Settings</p>
      {items.map((item) => {
        const isActive = !item.external && item.href === active;
        const className = `admin-hover-fill flex items-center justify-between gap-2 border-l-2 px-4 py-2 text-sm ${
          isActive ? "border-primary font-medium text-ink" : "border-transparent text-muted hover:text-ink"
        }`;
        const body = (
          <>
            <span>{item.label}</span>
            {item.needsAttention ? (
              <span
                title={item.needsAttention}
                aria-label={item.needsAttention}
                className="size-1.5 shrink-0 rounded-full bg-destructive"
              />
            ) : null}
          </>
        );
        return item.external ? (
          <Link key={item.href} href={item.href} className={className}>
            {body}
          </Link>
        ) : (
          <a key={item.href} href={item.href} className={className}>
            {body}
          </a>
        );
      })}
    </nav>
  );
}
