import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { SpreadsheetImportSection } from "@/components/import/section";

// Applicants arrive here rather than in Centre Management: adding forty
// applicants is the same act as adding one, and adding one is Admissions'
// job. See the note on SpreadsheetImportSection.
export default async function AdmissionsImportPage() {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  // No centre_roles rows at all -- the legacy flat-admin case the rest of
  // this codebase already treats as full access.
  const mayImport = ctx.roles.length === 0 || can(ctx.roles, "import.run", ctx.overrides);
  if (!mayImport) redirect("/dashboard/admissions");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Admissions</p>
          <h1 className="font-serif text-2xl text-ink">Import applicants from a spreadsheet</h1>
        </div>
        <Link href="/dashboard/admissions" className="text-sm text-muted hover:text-ink">
          Back to admissions
        </Link>
      </div>

      <SpreadsheetImportSection kind="applicants" centerId={profile.center_id} />
    </div>
  );
}
