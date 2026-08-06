import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { getCurrentProfile } from "@/lib/auth/get-profile";

// Shared shell for every /trainer/* page -- just the wordmark now. The
// tab bar + view-switcher pill moved into (hub)/layout.tsx, since they
// only belong on the operational Command Centre pages (roster/timetable/
// volunteers/etc.), not the /trainer landing itself -- landing has its
// own "Command Centre" button leading into the hub instead.
export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentProfile();
  const profile = session?.profile ?? null;

  return (
    // min-h-screen, not min-h-full: a percentage min-height here silently
    // breaks position:sticky for any descendant (confirmed live -- the
    // timetable's floating time band would not stick until this changed).
    // min-h-screen achieves the same "fill at least the viewport" look via
    // a viewport unit instead of a parent-percentage chain, which sticky's
    // containing-block calculation doesn't choke on. Kept here since this
    // layout still wraps the timetable page underneath (hub).
    <div className="flex min-h-screen flex-col bg-background">
      <div className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/trainer" className="block">
            <Wordmark size="sm" />
          </Link>
          {/* Same gap this whole /trainer subtree had -- (hub)/layout.tsx
              just got the same fix. Landing page itself never showed a
              staff greeting either, so this was the only place a name
              could have shown on the way in. */}
          {profile ? (
            <span className="text-sm text-muted">{profile.full_name ?? session?.email}</span>
          ) : null}
        </div>
      </div>

      {children}
    </div>
  );
}
