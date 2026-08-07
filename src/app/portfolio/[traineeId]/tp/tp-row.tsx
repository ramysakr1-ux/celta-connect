"use client";

import { useRouter } from "next/navigation";

// Same whole-row-clickable idiom as roster-row.tsx (checkpoint 2) -- one
// pattern for both tables in this checkpoint rather than two.
export function TpRow({ href, children }: { href: string | null; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className={href ? "cursor-pointer hover:bg-accent/20" : ""}
      onClick={href ? () => router.push(href) : undefined}
    >
      {children}
    </tr>
  );
}
