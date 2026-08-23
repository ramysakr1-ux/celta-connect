import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformOwnerGreeting } from "@/lib/platform-owner-greeting";
import { CreateCentreForm, ChangeRoleForm } from "@/app/platform/platform-forms";

// connect-platform-owner-role-spec-2026-08-22.md's "keep it minimal": the
// immediate need is the role existing and one real account able to
// bootstrap the first centre/course, not a full cross-centre admin
// rebuild. Reads through the service-role admin client throughout (not
// createClient()) since this is the one screen meant to see across every
// centre at once -- RLS stays centre-scoped everywhere else, per that same
// spec's scope note deferring true cross-centre RLS to a follow-up.
//
// The personal greeting (for-claude-code-role-tinted-backgrounds-v2-final.md)
// lives here, not on /platform/command-center -- this is the actual landing
// page right after login (Ramy, 22 Aug 2026, catching that the spec had
// scoped it one click too deep).
export default async function PlatformPage() {
  const profile = await requireRole("platform_owner");
  const admin = createAdminClient();

  const [{ data: centers }, { data: courses }, greeting] = await Promise.all([
    admin.from("centers").select("id, name, center_number, is_demo, created_at").order("created_at", { ascending: false }),
    admin.from("courses").select("id, center_id"),
    getPlatformOwnerGreeting(profile.full_name),
  ]);

  const courseCountByCenter = new Map<string, number>();
  for (const c of courses ?? []) {
    courseCountByCenter.set(c.center_id, (courseCountByCenter.get(c.center_id) ?? 0) + 1);
  }

  return (
    <div className="container py-8">
      <div className="frame flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{greeting.dateEyebrow}</p>
          <h1 className="mt-1 font-serif text-2xl text-ink">
            Good {greeting.timeOfDay}, {greeting.firstName}
          </h1>
          <p className="mt-1 text-sm text-muted">{greeting.recap}</p>
        </div>
        <Link
          href="/platform/command-center"
          className="h-10 shrink-0 rounded-[6px] border border-primary/40 px-4 text-sm font-semibold leading-10 text-primary hover:bg-primary/5"
        >
          Command center
        </Link>
      </div>

      <div className="card p-5">
        <h2 className="font-serif text-lg text-ink">Create a centre</h2>
        <p className="mt-1 text-sm text-muted">
          Sets up the centre and a one-time join link for its first centre owner -- they create their own account and
          password through it, same as any other centre-admin invite.
        </p>
        <div className="mt-4">
          <CreateCentreForm />
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-serif text-lg text-ink">Change a user's role</h2>
        <p className="mt-1 text-sm text-muted">Looks someone up by email and sets their account-level role directly.</p>
        <div className="mt-4">
          <ChangeRoleForm />
        </div>
      </div>

      <div className="card">
        <div className="border-b border-border-faint px-5 py-3.5">
          <h2 className="font-serif text-lg text-ink">Every centre ({(centers ?? []).length})</h2>
        </div>
        {(centers ?? []).length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No centres yet.</p>
        ) : (
          (centers ?? []).map((c) => (
            <div key={c.id} className="list-row flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">
                  {c.name}
                  {c.is_demo ? <span className="ml-2 text-xs font-normal text-muted">(demo)</span> : null}
                </span>
                <span className="text-xs text-muted">Centre {c.center_number}</span>
              </div>
              <span className="text-sm text-muted">
                {courseCountByCenter.get(c.id) ?? 0} course{(courseCountByCenter.get(c.id) ?? 0) === 1 ? "" : "s"}
              </span>
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
