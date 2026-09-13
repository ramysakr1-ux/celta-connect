import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCourseTutorRole } from "@/lib/course-tutor-role";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { mergeGlossary, type CentreGlossaryTerm } from "@/lib/criteria-glossary";

// The criteria glossary as one centre sees it, and who is allowed to change it.
//
// Ramy, 13 Sep 2026: "put the glossary behind a Centre Management screen and
// MCT as well" — then "ACT too". So the people who may edit it are the people
// who actually speak the shorthand: any tutor at the centre, main course tutor
// or assistant, plus a Centre manager who can already edit centre settings.

export interface GlossaryRow extends CentreGlossaryTerm {
  id: string;
  updated_at: string;
  updated_by: string | null;
  editor_name?: string | null;
}

export async function getCentreGlossaryRows(centerId: string): Promise<GlossaryRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("center_criteria_terms")
    .select("id, term, criteria_codes, enabled, updated_at, updated_by")
    .eq("center_id", centerId)
    .order("term");
  const rows = (data ?? []) as GlossaryRow[];

  const editorIds = [...new Set(rows.map((r) => r.updated_by).filter(Boolean))] as string[];
  if (editorIds.length === 0) return rows;
  const { data: people } = await admin.from("profiles").select("id, full_name").in("id", editorIds);
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  return rows.map((r) => ({ ...r, editor_name: r.updated_by ? nameById.get(r.updated_by) ?? null : null }));
}

/** Built-in table + this centre's own terms, minus anything it has switched off. */
export async function getCentreGlossary(centerId: string | null | undefined): Promise<Record<string, string[]>> {
  if (!centerId) return mergeGlossary([]);
  const rows = await getCentreGlossaryRows(centerId);
  return mergeGlossary(rows);
}

export interface GlossaryChange {
  term: string;
  action: string;
  codes_before: string[] | null;
  codes_after: string[] | null;
  changed_at: string;
  changed_by_name: string | null;
}

/** The footprint: who changed what, from what to what, and when. */
export async function getGlossaryChanges(centerId: string, limit = 20): Promise<GlossaryChange[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("center_criteria_term_changes")
    .select("term, action, codes_before, codes_after, changed_at, changed_by")
    .eq("center_id", centerId)
    .order("changed_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))] as string[];
  const { data: people } = ids.length
    ? await admin.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  return rows.map((r) => ({
    term: r.term,
    action: r.action,
    codes_before: r.codes_before,
    codes_after: r.codes_after,
    changed_at: r.changed_at,
    changed_by_name: r.changed_by ? nameById.get(r.changed_by) ?? null : null,
  }));
}

export interface GlossaryEditor {
  centerId: string;
  /** How this person reaches the screen, for the change log line. */
  as: "Main course tutor" | "Assistant course tutor" | "Tutor" | "Centre manager";
}

/**
 * May this profile edit the centre's glossary? Any tutor at the centre may --
 * MCT, ACT or otherwise -- and so may a centre role that can edit centre
 * settings. Everyone else gets null.
 */
export async function glossaryEditorFor(profile: {
  id: string;
  role: string;
  center_id: string | null;
  course_id?: string | null;
}): Promise<GlossaryEditor | null> {
  if (!profile.center_id) return null;

  if (profile.role === "trainer") {
    const tutorRole = profile.course_id ? await getCourseTutorRole(profile.course_id, profile.id) : null;
    return {
      centerId: profile.center_id,
      as:
        tutorRole === "main_course_tutor"
          ? "Main course tutor"
          : tutorRole === "assistant_course_tutor"
            ? "Assistant course tutor"
            : "Tutor",
    };
  }
  if (profile.role === "admin") return { centerId: profile.center_id, as: "Centre manager" };

  const ctx = await getCentreRoleContext({ id: profile.id, center_id: profile.center_id, role: profile.role });
  if (ctx.roles.length > 0 && can(ctx.roles, "centre.settings.edit", ctx.overrides)) {
    return { centerId: profile.center_id, as: "Centre manager" };
  }
  return null;
}
