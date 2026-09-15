import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { SpreadsheetImportSection } from "@/components/import/section";

// Volunteers arrive in the volunteer pool, the room that already holds
// them. This is also the half a course administrator can run: they hold
// volunteers.manage but not import.run, which the old single page had to
// special-case.
export default async function VolunteerImportPage() {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  const mayImport = ctx.roles.length === 0 || can(ctx.roles, "volunteers.manage", ctx.overrides);
  if (!mayImport) redirect("/centre/volunteers");
  // The branch you are actually looking at. A branch owner switching to
  // another branch got their HOME centre's courses here, so the only
  // courses offered were ones the pool beside it wasn't showing (walked
  // 15 Sep 2026) -- same `activeCenterId ?? center_id` every other room in
  // Centre Management uses.
  const centerId = ctx.activeCenterId ?? profile.center_id;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Volunteer pool</p>
          <h1 className="font-serif text-2xl text-ink">Import volunteers from a spreadsheet</h1>
        </div>
        <Link href="/centre/volunteers" className="text-sm text-muted hover:text-ink">
          Back to the volunteer pool
        </Link>
      </div>

      <SpreadsheetImportSection kind="volunteers" centerId={centerId} />
    </div>
  );
}
