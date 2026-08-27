import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "@/app/centre/import/import-wizard";
import { UndoImportButton } from "@/app/centre/import/undo-import-button";
import { VolunteerImportWizard } from "@/app/centre/import/volunteer-import-wizard";
import { UndoVolunteerImportButton } from "@/app/centre/import/undo-volunteer-import-button";
import { UNDO_WINDOW_DAYS, isWithinUndoWindow, undoDeadline } from "@/lib/spreadsheet-import";

// Centre Admin's "Import" tab (for-claude-code-centre-admin-full.md). Lives
// under /dashboard/admin rather than as a trainer tab -- this is the
// money-and-oversight role's screen, not a tutor's.
//
// Ramy, 26 Aug 2026: "we already have imports as a tab... I don't know why
// we need to build another one" -- volunteer import folded into this same
// page/tab rather than a separate destination, choosing what to import
// (Applicants / Volunteers) as the first decision instead of a nav tab.
// Real permission wrinkle found while wiring this up: course_administrator
// has volunteers.manage but not import.run, so gating page ENTRY on
// import.run alone (the pre-existing check) would have locked that role out
// of volunteer import entirely -- entry is now either capability, and each
// half of the page gates on its own.
export default async function ImportPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  // No centre_roles rows at all -- the legacy/flat-admin case the rest of
  // this file's permission checks already treat as full access.
  const noSpecificRoles = ctx.roles.length === 0;
  const canApplicants = noSpecificRoles || can(ctx.roles, "import.run", ctx.overrides);
  const canVolunteers = noSpecificRoles || can(ctx.roles, "volunteers.manage", ctx.overrides);
  if (!canApplicants && !canVolunteers) redirect("/centre");

  const { kind: kindParam } = await searchParams;
  const kind: "applicants" | "volunteers" =
    kindParam === "volunteers" && canVolunteers
      ? "volunteers"
      : kindParam === "applicants" && canApplicants
        ? "applicants"
        : canApplicants
          ? "applicants"
          : "volunteers";

  const supabase = await createClient();
  // Ramy, 27 Aug 2026 (round 2): courses, imports, and (when viewing the
  // applicants kind) the existing-applicant-emails lookup don't depend on
  // each other -- all three only need profile.center_id/kind, already
  // known. The emails lookup used to live inside ApplicantImportSection, an
  // async child rendered AFTER this batch resolved -- a whole extra
  // sequential round trip on every real Vercel-function measurement (traced
  // live via Vercel's own request logs, not just query-counting) for a
  // query that never needed to wait.
  const [{ data: courses }, { data: imports }, { data: applicantEmailRows }] = await Promise.all([
    supabase.from("courses").select("id, name, end_date").eq("center_id", profile.center_id).order("name"),
    supabase
      .from("spreadsheet_imports")
      .select("id, source_filename, tallies, created_at, undone_at, kind")
      .eq("center_id", profile.center_id)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(5),
    kind === "applicants"
      ? supabase.from("applicants").select("email").eq("center_id", profile.center_id)
      : Promise.resolve({ data: [] as { email: string }[] }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Centre management</p>
          <h1 className="font-serif text-2xl text-ink">Import from a spreadsheet</h1>
        </div>
        <Link href="/centre" className="text-sm text-muted hover:text-ink">
          Back to centre management
        </Link>
      </div>

      {canApplicants && canVolunteers ? (
        <div className="flex gap-2">
          {/* Ramy, 26 Aug 2026: "whatever you click on becomes green... it
              doesn't need to be green permanently" -- one active-state
              colour for either pill, not teal-for-one/green-for-other. */}
          {(["applicants", "volunteers"] as const).map((k) => {
            const isActive = kind === k;
            return (
              <Link
                key={k}
                href={`/centre/import?kind=${k}`}
                className={`rounded-[6px] px-3 py-1.5 text-sm font-medium ${
                  isActive
                    ? "text-white"
                    : "admin-hover-fill border border-border text-muted hover:border-primary hover:text-primary"
                }`}
                style={isActive ? { background: "oklch(35% 0.075 155)" } : undefined}
              >
                {k === "applicants" ? "Applicants" : "Volunteers"}
              </Link>
            );
          })}
        </div>
      ) : null}

      {(courses ?? []).length === 0 ? (
        <div className="sheet text-sm text-muted">
          There are no courses in this centre yet. An import has to land on a specific course, so create one first.
        </div>
      ) : kind === "applicants" ? (
        <ImportWizard courses={courses ?? []} existingEmails={(applicantEmailRows ?? []).map((a) => a.email.toLowerCase())} />
      ) : (
        <VolunteerImportSection courses={courses ?? []} />
      )}

      {(imports ?? []).length > 0 ? (
        <div className="sheet flex flex-col gap-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Recent imports</p>
          {(imports ?? []).map((imp, i) => {
            const tallies = (imp.tallies ?? {}) as { willImport?: number };
            const undoable = !imp.undone_at && isWithinUndoWindow(imp.created_at);
            return (
              <div key={imp.id} className={`admin-hover flex items-center justify-between gap-3 py-2 ${i > 0 ? "border-t border-border-faint" : ""}`}>
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
                {undoable ? kind === "applicants" ? <UndoImportButton importId={imp.id} /> : <UndoVolunteerImportButton importId={imp.id} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

async function VolunteerImportSection({ courses }: { courses: { id: string; name: string; end_date: string }[] }) {
  const supabase = await createClient();
  const courseIds = courses.map((c) => c.id);
  const { data: volunteers } =
    courseIds.length > 0 ? await supabase.from("volunteer_students").select("course_id, email").in("course_id", courseIds) : { data: [] };

  // Scoped per-course, not flattened across the whole centre -- the wizard's
  // duplicate check needs "already on THIS course", not "already anywhere
  // at this centre" (which would wrongly block someone simply new to a
  // different course).
  const existingEmailsByCourse: Record<string, string[]> = {};
  for (const v of volunteers ?? []) {
    if (!v.email) continue;
    (existingEmailsByCourse[v.course_id] ??= []).push(v.email.toLowerCase());
  }

  return <VolunteerImportWizard courses={courses} existingEmailsByCourse={existingEmailsByCourse} />;
}
