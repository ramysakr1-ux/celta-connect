import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { TrainerTabs } from "@/app/trainer/trainer-tabs";

// Shared shell for every /trainer/* page -- was previously missing
// entirely, so /trainer and /trainer/timetable rendered with no header/nav
// at all (bare root layout, full-bleed width). Mirrors the portfolio
// shell's header + tab bar pattern (§3) rather than inventing a new one.
export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/trainer" className="block">
            <Wordmark size="sm" />
            <p className="text-[10px] tracking-[0.1em] text-muted uppercase">Command Centre</p>
          </Link>
        </div>
      </div>

      <TrainerTabs />

      <div className="container flex-1 py-8">{children}</div>
    </div>
  );
}
