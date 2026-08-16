"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import {
  analyseRows,
  isWithinUndoWindow,
  type ColumnMapping,
  type StatusValueMapping,
} from "@/lib/spreadsheet-import";

export interface CommitImportState {
  error?: string;
  importId?: string;
  imported?: number;
}

/**
 * The commit re-runs analyseRows server-side against freshly fetched emails
 * rather than trusting the verdicts the browser computed for the preview. The
 * client can't be allowed to decide who counts as a duplicate, and the DB may
 * have moved on between preview and commit anyway.
 *
 * Deliberately writes `applicants` rows and NOTHING else -- no invitation, no
 * offer token, no email. Per the spec this is the single most important
 * property of the whole feature.
 */
export async function commitImport(_prev: CommitImportState, formData: FormData): Promise<CommitImportState> {
  const profile = await requireRole("admin");
  // requireRole only proves flat `admin`, which a Centre manager also is. An
  // import creates people, which is squarely "edit anything at all" -- the one
  // thing that role may never do. The nav already omits the tab; this is the
  // check that matters if someone reaches the URL directly.
  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length > 0 && !can(ctx.roles, "import.run")) {
    return { error: "Your role can't import people." };
  }
  const supabase = await createClient();

  const intakeCourseId = formData.get("intake_course_id") as string | null;
  const sourceFilename = (formData.get("source_filename") as string | null)?.trim();
  if (!intakeCourseId) return { error: "Choose which intake these people belong to." };
  if (!sourceFilename) return { error: "Missing the file name." };

  let headers: string[];
  let rows: string[][];
  let mapping: ColumnMapping;
  let statusMapping: StatusValueMapping;
  try {
    headers = JSON.parse(formData.get("headers") as string);
    rows = JSON.parse(formData.get("rows") as string);
    mapping = JSON.parse(formData.get("mapping") as string);
    statusMapping = JSON.parse(formData.get("status_mapping") as string);
  } catch {
    return { error: "Could not read the sheet. Go back and choose the file again." };
  }

  // The intake must belong to this admin's centre -- an admin of centre A must
  // not be able to post a course id from centre B.
  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", intakeCourseId)
    .eq("center_id", profile.center_id)
    .maybeSingle();
  if (!course) return { error: "That intake isn't in your centre." };

  const { data: existing } = await supabase.from("applicants").select("email").eq("center_id", profile.center_id);
  const existingEmails = new Set((existing ?? []).map((a) => a.email.toLowerCase()));

  const analysis = analyseRows({ headers, rows, mapping, statusMapping, existingEmails });
  if (analysis.unmappedStatusValues.length > 0) {
    return { error: "Some status values still need a decision." };
  }

  const toInsert = analysis.rows.filter((r) => r.verdict === "import");
  if (toInsert.length === 0) return { error: "Nothing in this sheet would be imported." };

  const { data: importRow, error: importError } = await supabase
    .from("spreadsheet_imports")
    .insert({
      center_id: profile.center_id,
      intake_course_id: intakeCourseId,
      source_filename: sourceFilename,
      column_mapping: mapping,
      status_value_mapping: statusMapping,
      tallies: analysis.tallies,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (importError || !importRow) return { error: "Could not start the import. Nothing was created." };

  // `applicants` has SELECT and UPDATE policies but deliberately NO INSERT
  // policy (migration 0081) -- every write goes through the admin client after
  // the action has done its own validation, same documented pattern as
  // apply/actions.ts's public application form. Caught live: with the session
  // client this failed with "new row violates row-level security policy".
  //
  // Service role means no RLS backstop, so the centre scoping above is the
  // only thing enforcing it: center_id comes from the caller's own profile,
  // never from the form, and the intake course was checked to be in it.
  const admin = createAdminClient();
  const { error: insertError } = await admin.from("applicants").insert(
    toInsert.map((r) => ({
      center_id: profile.center_id,
      intake_course_id: intakeCourseId,
      import_id: importRow.id,
      full_name: r.fullName,
      email: r.email!,
      stage: r.stage,
      phone: r.values.phone ?? null,
      date_of_birth: r.values.date_of_birth ?? null,
      education_summary: r.values.education_summary ?? null,
      elt_experience_summary: r.values.elt_experience_summary ?? null,
      special_requirements: r.values.special_requirements ?? null,
      anything_else: r.values.anything_else ?? null,
    }))
  );
  if (insertError) {
    // Roll the import record back so a failed run doesn't leave a phantom
    // undo-able import with nothing attached to it.
    //
    // Via the admin client: spreadsheet_imports has select/insert/update
    // policies but no DELETE one, so on the session client this rollback
    // silently deleted nothing and the failed run still showed up under
    // "Recent imports" claiming rows it never created. Caught live.
    await admin.from("spreadsheet_imports").delete().eq("id", importRow.id);
    return { error: `Could not import: ${insertError.message}` };
  }

  revalidatePath("/dashboard/admin/import");
  revalidatePath("/dashboard/admissions");
  return { importId: importRow.id, imported: toInsert.length };
}

export interface UndoImportState {
  error?: string;
  removed?: number;
}

/**
 * "One button removes everything it created, provided nobody has been invited
 * or paid since." Both conditions are checked against the real records, not a
 * flag we set hopefully at import time.
 */
export async function undoImport(_prev: UndoImportState, formData: FormData): Promise<UndoImportState> {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length > 0 && !can(ctx.roles, "import.run")) {
    return { error: "Your role can't undo an import." };
  }
  const supabase = await createClient();

  const importId = formData.get("import_id") as string | null;
  if (!importId) return { error: "Missing the import." };

  const { data: imp } = await supabase
    .from("spreadsheet_imports")
    .select("id, created_at, undone_at")
    .eq("id", importId)
    .eq("center_id", profile.center_id)
    .maybeSingle();
  if (!imp) return { error: "That import isn't in your centre." };
  if (imp.undone_at) return { error: "That import has already been undone." };
  if (!isWithinUndoWindow(imp.created_at)) {
    return { error: "This import is more than seven days old -- it's ordinary data now and can't be bulk-undone." };
  }

  // Same reason as the insert above: applicants has no DELETE policy either,
  // so the removal below must go through the admin client. Reads are fine on
  // the session client (can_handle_admissions() covers admins) but are done
  // here too so the rows read are exactly the rows deleted.
  const admin = createAdminClient();
  const { data: people } = await admin
    .from("applicants")
    .select("id, full_name, offer_sent_at, offer_token")
    .eq("import_id", importId)
    .eq("center_id", profile.center_id);
  const ids = (people ?? []).map((p) => p.id);
  if (ids.length === 0) return { error: "This import has nothing left to remove." };

  const invited = (people ?? []).filter((p) => p.offer_sent_at || p.offer_token);
  if (invited.length > 0) {
    return {
      error: `Can't undo -- ${invited.length} of these people have been invited since (${invited
        .slice(0, 3)
        .map((p) => p.full_name)
        .join(", ")}${invited.length > 3 ? ", ..." : ""}). Remove them individually instead.`,
    };
  }

  const { data: paid } = await supabase.from("payment_plans").select("applicant_id").in("applicant_id", ids);
  if ((paid ?? []).length > 0) {
    return { error: `Can't undo -- ${paid!.length} of these people have a payment plan. Remove them individually instead.` };
  }

  const { error: deleteError } = await admin
    .from("applicants")
    .delete()
    .eq("import_id", importId)
    .eq("center_id", profile.center_id);
  if (deleteError) return { error: `Could not undo: ${deleteError.message}` };

  await supabase
    .from("spreadsheet_imports")
    .update({ undone_at: new Date().toISOString(), undone_by: profile.id })
    .eq("id", importId);

  revalidatePath("/dashboard/admin/import");
  revalidatePath("/dashboard/admissions");
  return { removed: ids.length };
}
