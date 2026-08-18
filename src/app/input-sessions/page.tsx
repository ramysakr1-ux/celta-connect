import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { INPUT_SESSIONS } from "@/app/input-sessions/registry";

// Fixed content, reachable by anyone on a real course (trainer, admin, or
// trainee) -- not nested under /portfolio/[traineeId] or /trainer since
// nothing here is per-candidate data, same reasoning as the GTKY bank
// staying out of the resource-hub's per-centre upload model.
export default async function InputSessionsIndexPage() {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-10">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Resource hub</p>
        <h1 className="mt-1 font-serif text-2xl text-ink">Input sessions</h1>
        <p className="mt-2 text-sm text-muted">Interactive versions of the centre&apos;s input sessions — the same content whether you&apos;re running one or working through it.</p>
      </div>
      <div className="flex flex-col gap-2">
        {INPUT_SESSIONS.map((s) => (
          <Link
            key={s.slug}
            href={`/input-sessions/${s.slug}`}
            className="flex items-center justify-between gap-4 rounded-[8px] border border-border bg-card px-4 py-3 hover:border-primary"
          >
            <div>
              <p className="text-sm font-semibold text-ink">{s.title}</p>
              <p className="text-xs text-muted">{s.kind}</p>
            </div>
            <p className="text-xs text-muted">{s.minutes}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
