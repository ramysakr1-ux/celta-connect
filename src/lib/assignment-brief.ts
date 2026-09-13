import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import type { TemplateSection } from "@/lib/assignment-templates/content";

// Which brief an assignment is being read against.
//
// A candidate still writing follows the brief as it stands now. A candidate
// who has submitted keeps the brief they answered -- Administration Handbook
// June 2025 12.1.1 puts the completed assignments in the portfolio the
// assessor reads, and evidence does not change its meaning because somebody
// edited the question afterwards.
//
// Before migration 0300 there was only ever "now": section keys changed under
// submitted work and every answer and tutor comment went to "(no response)",
// silently. Every screen that renders an assignment's sections resolves them
// through here, so no screen can get this half-right on its own.

type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];

export interface ResolvedBrief {
  sections: TemplateSection[];
  format: "prose" | "structured";
  /** The template row's id, for the editor links. */
  templateId: string | null;
  /** Which published version this is, when the submission is pinned to one. */
  version: number | null;
  /** True when the brief has moved on since this was submitted. */
  supersededBy: number | null;
}

export async function resolveBrief(
  supabase: SupabaseClient<Database>,
  assignment: Pick<AssignmentRow, "assignment_type" | "template_version_id">,
  centerId: string
): Promise<ResolvedBrief | null> {
  const { data: template } = await supabase
    .from("assignment_templates")
    .select("id, sections, format, published_at")
    .eq("center_id", centerId)
    .eq("assignment_type", assignment.assignment_type)
    .not("published_at", "is", null)
    .maybeSingle();

  // Not pinned: a draft, or a row from before 0300. The current brief is the
  // right answer for both.
  if (!assignment.template_version_id) {
    if (!template) return null;
    return { sections: template.sections, format: template.format, templateId: template.id, version: null, supersededBy: null };
  }

  const { data: pinned } = await supabase
    .from("assignment_template_versions")
    .select("sections, format, version, template_id")
    .eq("id", assignment.template_version_id)
    .maybeSingle();
  if (!pinned) {
    if (!template) return null;
    return { sections: template.sections, format: template.format, templateId: template.id, version: null, supersededBy: null };
  }

  const { data: latest } = await supabase
    .from("assignment_template_versions")
    .select("version")
    .eq("template_id", pinned.template_id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    sections: pinned.sections,
    format: pinned.format,
    templateId: pinned.template_id,
    version: pinned.version,
    supersededBy: latest && latest.version > pinned.version ? latest.version : null,
  };
}

/**
 * Publishes a new version of a brief's sections, and keeps every draft that
 * was written against the old ones.
 *
 * Two rules, and they are different on purpose:
 *  - a SUBMITTED assignment is pinned to the version it answered and is not
 *    touched here at all;
 *  - a DRAFT follows the new brief, so the candidate's own words are carried
 *    across to the new sections rather than being orphaned. Text the
 *    candidate wrote is theirs; losing it to a brief edit would be the worse
 *    failure of the two.
 */
export async function publishBriefVersion(
  supabase: SupabaseClient<Database>,
  {
    templateId,
    centerId,
    assignmentType,
    sections,
    format,
    publishedBy,
  }: {
    templateId: string;
    centerId: string;
    assignmentType: Database["public"]["Tables"]["assignments"]["Row"]["assignment_type"];
    sections: TemplateSection[];
    format: "prose" | "structured";
    publishedBy: string;
  }
): Promise<{ error: string | null; version?: number; draftsCarried?: number }> {
  // A published version is a record, not a setting: there is deliberately no
  // insert/update/delete policy on the table, so the write goes through the
  // service role AFTER the calling action has checked the capability. The
  // same shape the centre settings screens already use -- and without it the
  // insert is refused by RLS and the edit silently fails to save at all,
  // which is what happened on the first live attempt (13 Sep 2026).
  const writer = createAdminClient();

  const { data: latest } = await writer
    .from("assignment_template_versions")
    .select("version, sections, format")
    .eq("template_id", templateId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const unchanged =
    latest && latest.format === format && JSON.stringify(latest.sections) === JSON.stringify(sections);
  if (unchanged) return { error: null, version: latest.version, draftsCarried: 0 };

  const version = (latest?.version ?? 0) + 1;
  const { error: versionError } = await writer.from("assignment_template_versions").insert({
    template_id: templateId,
    center_id: centerId,
    assignment_type: assignmentType,
    version,
    sections,
    format,
    published_by: publishedBy,
  });
  if (versionError) return { error: versionError.message };

  const { error: templateError } = await writer
    .from("assignment_templates")
    .update({ sections, format })
    .eq("id", templateId);
  if (templateError) return { error: templateError.message };

  // Drafts can sit on any course at the centre, not only the caller's own,
  // so the carry-across uses the same writer.
  const draftsCarried = await carryDraftsToNewSections(writer, centerId, assignmentType, sections);
  return { error: null, version, draftsCarried };
}

/**
 * Moves each unsubmitted draft's answers onto the new section keys. A key
 * that survived the edit keeps its own row; the rest are filled in the order
 * they were written, which is the only mapping that exists once a key is
 * gone. Nothing the candidate typed is deleted.
 */
async function carryDraftsToNewSections(
  supabase: SupabaseClient<Database>,
  centerId: string,
  assignmentType: Database["public"]["Tables"]["assignments"]["Row"]["assignment_type"],
  sections: TemplateSection[]
): Promise<number> {
  const { data: trainees } = await supabase.from("profiles").select("id").eq("center_id", centerId).eq("role", "trainee");
  const traineeIds = (trainees ?? []).map((t) => t.id);
  if (traineeIds.length === 0) return 0;

  const { data: drafts } = await supabase
    .from("assignments")
    .select("id")
    .in("trainee_id", traineeIds)
    .eq("assignment_type", assignmentType)
    .eq("first_status", "not_submitted");
  const draftIds = (drafts ?? []).map((d) => d.id);
  if (draftIds.length === 0) return 0;

  const { data: rows } = await supabase.from("assignment_section_responses").select("*").in("assignment_id", draftIds);
  const wanted = new Set(sections.map((s) => s.key));
  let carried = 0;

  for (const id of draftIds) {
    const existing = (rows ?? []).filter((r) => r.assignment_id === id);
    if (existing.length === 0) continue;
    if (existing.every((r) => wanted.has(r.section_key))) continue;

    const byKey = new Map(existing.map((r) => [r.section_key, r]));
    const spare = existing
      .filter((r) => !wanted.has(r.section_key))
      .sort((x, y) => (x.created_at ?? "").localeCompare(y.created_at ?? ""));

    const next = sections.map((sec) => {
      const old = byKey.get(sec.key) ?? spare.shift();
      return {
        assignment_id: id,
        section_key: sec.key,
        section_title: sec.title,
        first_response: old?.first_response ?? null,
        resubmission_response: old?.resubmission_response ?? null,
        first_comments: old?.first_comments ?? null,
        resubmission_comments: old?.resubmission_comments ?? null,
      };
    });

    await supabase.from("assignment_section_responses").delete().eq("assignment_id", id);
    const { error } = await supabase.from("assignment_section_responses").insert(next);
    if (!error) carried += 1;
  }
  return carried;
}

/** How many submissions are pinned to a brief -- what an editor is about to leave behind. */
export async function countSubmissionsAgainstBrief(
  supabase: SupabaseClient<Database>,
  centerId: string,
  assignmentType: Database["public"]["Tables"]["assignments"]["Row"]["assignment_type"]
): Promise<number> {
  const { data: trainees } = await supabase.from("profiles").select("id").eq("center_id", centerId).eq("role", "trainee");
  const traineeIds = (trainees ?? []).map((t) => t.id);
  if (traineeIds.length === 0) return 0;
  const { count } = await supabase
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .in("trainee_id", traineeIds)
    .eq("assignment_type", assignmentType)
    .neq("first_status", "not_submitted");
  return count ?? 0;
}
