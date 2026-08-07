import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { createAdminClient } from "@/lib/supabase/admin";

// §2 -- centre-facing public front door. No session exists yet here, so the
// centre name/code is read via the admin client (same pre-auth pattern as
// /join/[token]) rather than gated by RLS. Hero copy is a placeholder per
// the plan's explicit instruction not to let final wording block the build.
export default async function Home() {
  const admin = createAdminClient();
  const { data: center } = await admin.from("centers").select("name, center_number").limit(1).maybeSingle();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="border-b border-border bg-card">
        <div className="container flex h-16 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-primary">
            <GraduationCap className="size-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <div>
            <Wordmark size="header" />
            {center ? (
              <p className="text-[11px] tracking-[0.08em] text-muted uppercase">
                {center.name} · Centre {center.center_number}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="container flex-1 pt-16">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
          {center ? `${center.name} · Cambridge CELTA` : "Cambridge CELTA"}
        </p>
        <h1 className="mt-2 max-w-2xl font-serif text-5xl font-medium leading-[1.1] text-ink">
          Every candidate gets one link. Everything they need lives behind it.
        </h1>
        <p className="mt-4 max-w-[700px] text-base leading-6 text-muted">
          Each trainee holds a unique workspace URL. It opens their course stream,
          resource hub, teaching practice record, written assignments and their personal CELTA 5
          -- and nobody else&apos;s.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-base text-muted">Sign in to your Connect workspace.</p>
          <Link
            href="/login"
            className="rounded-[6px] bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Log in
          </Link>
          <p className="text-sm text-muted">Assessors and TP students: use the link emailed to you.</p>
        </div>
      </div>

      <footer className="mt-auto py-8 text-center text-xs text-muted">
        {center ? `${center.name} · Cambridge CELTA` : "Cambridge CELTA"}
      </footer>
    </div>
  );
}
