import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "@/app/centre/import/import-wizard";
import { UndoImportButton } from "@/app/centre/import/undo-import-button";
import { UNDO_WINDOW_DAYS, isWithinUndoWindow, undoDeadline } from "@/lib/spreadsheet-import";

// Centre Admin's "Import" tab (for-claude-code-centre-admin-full.md). Lives
// under /dashboard/admin rather than as a trainer tab -- this is the
// money-and-oversight role's screen, not a tutor's.
export default async function ImportPage() {
  const profile = await requireRole("admin");
  // A Centre manager is also a flat `admin`, and must not reach this screen at
  // all -- the nav omits the tab, and this stops the direct URL.
  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length > 0 && !can(ctx.roles, "import.run")) redirect("/centre");
  const supabase = await createClient();

  const [{ data: courses }, { data: applicants }, { data: imports }] = await Promise.all([
    supabase.from("courses").select("id, name").eq("center_id", profile.center_id).order("name"),
    // Sent to the client so the dry-run can flag duplicates as the admin maps,
    // without a round trip per keystroke. Emails only -- no other applicant
    // data crosses over. The commit re-checks server-side regardless.
    supabase.from("applicants").select("email").eq("center_id", profile.center_id),
    supabase
      .from("spreadsheet_imports")
      .select("id, source_filename, tallies, created_at, undone_at")
      .eq("center_id", profile.center_id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Centre admin</p>
          <h1 className="font-serif text-2xl text-ink">Import from a spreadsheet</h1>
        </div>
        <Link href="/centre" className="text-sm text-muted hover:text-ink">
          Back to centre admin
        </Link>
      </div>

      {(courses ?? []).length === 0 ? (
        <div className="sheet text-sm text-muted">
          There are no courses in this centre yet. An import has to land on a specific intake, so create a course
          first.
        </div>
      ) : (
        <ImportWizard
          courses={courses ?? []}
          existingEmails={(applicants ?? []).map((a) => a.email.toLowerCase())}
        />
      )}

      {(imports ?? []).length > 0 ? (
        <div className="sheet flex flex-col gap-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Recent imports</p>
          {(imports ?? []).map((imp, i) => {
            const tallies = (imp.tallies ?? {}) as { willImport?: number };
            const undoable = !imp.undone_at && isWithinUndoWindow(imp.created_at);
            return (
              <div
                key={imp.id}
                className={`flex items-center justify-between gap-3 py-2 ${i > 0 ? "border-t border-border-faint" : ""}`}
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm text-ink">{imp.source_filename}</p>
                  <p className="text-xs text-muted">
                    {tallies.willImport ?? 0} imported &middot; {new Date(imp.created_at).toLocaleDateString("en-GB")}
                    {imp.undone_at
                      ? " · undone"
                      : undoable
                        ? ` · undo until ${undoDeadline(imp.created_at).toLocaleDateString("en-GB")}`
                        : ` · older than ${UNDO_WINDOW_DAYS} days, now ordinary data`}
                  </p>
                </div>
                {undoable ? <UndoImportButton importId={imp.id} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
