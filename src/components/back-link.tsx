import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Ramy, 27 Aug 2026: "we need something more visually appealing than just
// an arrow heading back" -- replaces the plain muted "&larr; Label" text
// link used identically across ~9 pages with a real bordered button:
// clearly clickable, not just colored text. Sits inside a .card wrapper on
// every page that used it, so bg-card-inset (not bg-card) matches the
// established nested-element-inside-a-card convention.
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card-inset px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {label}
    </Link>
  );
}
