"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { getAccessTokenFromRefreshToken } from "@/lib/google/oauth";
import { analyseVolunteerRows, type VolunteerColumnMapping, type VolunteerImportAnalysis } from "@/lib/volunteer-spreadsheet-import";
import { isWithinUndoWindow } from "@/lib/spreadsheet-import";

// Ramy, 25/26 Aug 2026: "center management also have one" -- the volunteer
// counterpart to src/app/centre/import/actions.ts, gated on the
// already-defined-but-previously-unwired "volunteers.manage" capability
// (granted to Centre manager, Course administrator, Centre owner in
// centre-permissions.ts) rather than "import.run", which is specifically
// the applicant-pipeline import's own gate.
async function requireVolunteerImportRole() {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length > 0 && !can(ctx.roles, "volunteers.manage", ctx.overrides)) {
    throw new Error("Your role can't manage volunteers.");
  }
  return profile;
}

// Same centre-level Drive connection the applicant import and TP-materials
// pickers already use -- one connection, set once in Settings, good for
// every picker in the app.
export async function getCenterDriveAccessTokenForVolunteerImport(): Promise<{ accessToken: string } | { error: string }> {
  const profile = await requireVolunteerImportRole();
  const admin = createAdminClient();

  const { data: connection } = await admin
    .from("center_google_connections")
    .select("refresh_token")
    .eq("center_id", profile.center_id)
    .maybeSingle();

  if (!connection) return { error: "Your centre hasn't connected Google Drive yet -- connect it in Settings first." };

  try {
    const accessToken = await getAccessTokenFromRefreshToken(connection.refresh_token);
    return { accessToken };
  } catch {
    return { error: "Could not connect to the centre's Google Drive. Ask your admin to reconnect it in Settings." };
  }
}

export interface CommitVolunteerImportState {
  error?: string;
  importId?: string;
  imported?: number;
}

// Deliberately writes volunteer_students + their join token and NOTHING
// else -- no confirmation email, no class-starting email. Same principle as
// the applicant import: "an import that silently emails forty people is the
// fastest way to lose a centre in its first hour." Sending links afterward
// stays the separate, deliberate "Send links" action that already exists.
export async function commitVolunteerImport(_prev: CommitVolunteerImportState, formData: FormData): Promise<CommitVolunteerImportState> {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length > 0 && !can(ctx.roles, "volunteers.manage", ctx.overrides)) {
    return { error: "Your role can't manage volunteers." };
  }
  const supabase = await createClient();

  const courseId = formData.get("course_id") as string | null;
  const sourceFilename = (formData.get("source_filename") as string | null)?.trim();
  if (!courseId) return { error: "Choose which course these volunteers belong to." };
  if (!sourceFilename) return { error: "Missing the file name." };

  let headers: string[];
  let rows: string[][];
  let mapping: VolunteerColumnMapping;
  try {
    headers = JSON.parse(formData.get("headers") as string);
    rows = JSON.parse(formData.get("rows") as string);
    mapping = JSON.parse(formData.get("mapping") as string);
  } catch {
    return { error: "Could not read the sheet. Go back and choose the file again." };
  }

  // The course must belong to this admin's centre -- an admin of centre A
  // must not be able to post a course id from centre B.
  const { data: course } = await supabase
    .from("courses")
    .select("id, end_date")
    .eq("id", courseId)
    .eq("center_id", profile.center_id)
    .maybeSingle();
  if (!course) return { error: "That course isn't in your centre." };

  const { data: existing } = await supabase.from("volunteer_students").select("email").eq("course_id", courseId).not("email", "is", null);
  const existingEmails = new Set((existing ?? []).map((v) => (v.email as string).toLowerCase()));

  const analysis: VolunteerImportAnalysis = analyseVolunteerRows({ headers, rows, mapping, existingEmails });
  const toInsert = analysis.rows.filter((r) => r.verdict === "import");
  if (toInsert.length === 0) return { error: "Nothing in this sheet would be imported." };

  const { data: importRow, error: importError } = await supabase
    .from("spreadsheet_imports")
    .insert({
      center_id: profile.center_id,
      intake_course_id: courseId,
      kind: "volunteers",
      source_filename: sourceFilename,
      column_mapping: mapping,
      tallies: analysis.tallies,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (importError || !importRow) return { error: "Could not start the import. Nothing was created." };

  const admin = createAdminClient();
  const expiresAt = new Date(`${course.end_date}T23:59:59Z`).toISOString();

  const { data: inserted, error: insertError } = await admin
    .from("volunteer_students")
    .insert(
      toInsert.map((r) => ({
        course_id: courseId,
        name: r.name,
        email: r.email,
        level: r.level,
        import_id: importRow.id,
      }))
    )
    .select("id");
  if (insertError || !inserted) {
    await admin.from("spreadsheet_imports").delete().eq("id", importRow.id);
    return { error: `Could not import: ${insertError?.message ?? "unknown error"}` };
  }

  const { error: tokenError } = await admin.from("course_access_tokens").insert(
    inserted.map((v) => ({
      course_id: courseId,
      role: "volunteer_student" as const,
      volunteer_student_id: v.id,
      expires_at: expiresAt,
    }))
  );
  if (tokenError) {
    // The volunteer rows themselves are still valid even if their join
    // tokens failed to insert -- don't roll back people over that, but do
    // surface it so it can be re-run (the tokens table has no unique
    // constraint stopping a retry from adding a second token for the same
    // volunteer, so this is safe to just report rather than auto-retry).
    return { error: `${inserted.length} volunteers were added, but their join links could not be created. Try again or add links individually.` };
  }

  revalidatePath("/centre/volunteers");
  revalidatePath("/centre/import");
  return { importId: importRow.id, imported: inserted.length };
}

export interface UndoVolunteerImportState {
  error?: string;
  removed?: number;
}

export async function undoVolunteerImport(_prev: UndoVolunteerImportState, formData: FormData): Promise<UndoVolunteerImportState> {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length > 0 && !can(ctx.roles, "volunteers.manage", ctx.overrides)) {
    return { error: "Your role can't manage volunteers." };
  }
  const supabase = await createClient();

  const importId = formData.get("import_id") as string | null;
  if (!importId) return { error: "Missing the import." };

  const { data: imp } = await supabase
    .from("spreadsheet_imports")
    .select("id, created_at, undone_at, kind")
    .eq("id", importId)
    .eq("center_id", profile.center_id)
    .maybeSingle();
  if (!imp || imp.kind !== "volunteers") return { error: "That import isn't in your centre." };
  if (imp.undone_at) return { error: "That import has already been undone." };
  if (!isWithinUndoWindow(imp.created_at)) {
    return { error: "This import is more than seven days old -- it's ordinary data now and can't be bulk-undone." };
  }

  const admin = createAdminClient();
  const { data: volunteers } = await admin
    .from("volunteer_students")
    .select("id, name, signup_completed_at")
    .eq("import_id", importId)
    .eq("course_id", (await supabase.from("spreadsheet_imports").select("intake_course_id").eq("id", importId).single()).data?.intake_course_id ?? "");
  const ids = (volunteers ?? []).map((v) => v.id);
  if (ids.length === 0) return { error: "This import has nothing left to remove." };

  // Volunteer-side equivalent of "invited or paid" -- once someone has
  // actually completed their own sign-up (consent, recording, answers),
  // this has become real activity, not just an import artefact.
  const completed = (volunteers ?? []).filter((v) => v.signup_completed_at);
  if (completed.length > 0) {
    return {
      error: `Can't undo -- ${completed.length} of these volunteers have already signed up (${completed
        .slice(0, 3)
        .map((v) => v.name)
        .join(", ")}${completed.length > 3 ? ", ..." : ""}). Remove them individually instead.`,
    };
  }

  await admin.from("course_access_tokens").delete().in("volunteer_student_id", ids);
  const { error: deleteError } = await admin.from("volunteer_students").delete().eq("import_id", importId);
  if (deleteError) return { error: `Could not undo: ${deleteError.message}` };

  await supabase
    .from("spreadsheet_imports")
    .update({ undone_at: new Date().toISOString(), undone_by: profile.id })
    .eq("id", importId);

  revalidatePath("/centre/volunteers");
  revalidatePath("/centre/import");
  return { removed: ids.length };
}
