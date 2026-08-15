import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { DesignerCredit } from "@/components/designer-credit";
import { createAdminClient } from "@/lib/supabase/admin";

// §2 -- centre-facing public front door. No session exists yet here, so the
// centre name/code is read via the admin client (same pre-auth pattern as
// /join/[token]) rather than gated by RLS.
//
// Header previously paired a generic lucide GraduationCap icon next to the
// Wordmark -- predates specs/rename-to-connect.md's locked tile lockup,
// where the Wordmark's own ink tile already IS the app icon (see
// wordmark.tsx's header comment). Dropped the stray icon so this page
// matches the real mark everywhere else in the app (login, join, dashboard).
//
// Excludes is_demo centres -- this query assumes single-tenant (whichever
// centre comes back first), which silently broke the moment the seeded
// demo centre (build order #21) became a second row in this table.
export default async function Home() {
  const admin = createAdminClient();
  const { data: center } = await admin.from("centers").select("name, center_number").eq("is_demo", false).limit(1).maybeSingle();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="border-b border-border bg-card">
        <div className="container flex h-16 items-center gap-3">
          <Wordmark size="header" />
          {center ? (
            <p className="text-[11px] tracking-[0.08em] text-muted uppercase">
              {center.name} · Centre {center.center_number}
            </p>
          ) : null}
        </div>
      </div>

      <div className="container flex-1 pt-16">
        <Wordmark size="hero" />
        <h1 className="mt-6 max-w-2xl font-serif text-5xl font-medium leading-[1.1] text-ink">
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
          <a href="/demo" className="text-sm text-primary hover:underline">
            Or explore a live demo, no sign-up needed →
          </a>
        </div>
      </div>

      <footer className="mt-auto flex flex-col items-center gap-2 py-8 text-center text-xs text-muted">
        <p>{center ? `${center.name} · Cambridge CELTA` : "Cambridge CELTA"}</p>
        <DesignerCredit />
      </footer>
    </div>
  );
}
