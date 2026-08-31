import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const CAMBRIDGE_DOC_TYPES = ["syllabus", "admin_handbook", "appeals_procedure", "authorisation_certificate"] as const;
export type CambridgeDocType = (typeof CAMBRIDGE_DOC_TYPES)[number];

export const CAMBRIDGE_DOC_LABELS: Record<CambridgeDocType, string> = {
  syllabus: "CELTA Syllabus",
  admin_handbook: "CELTA Administration Handbook",
  appeals_procedure: "Cambridge Appeals Procedure",
  authorisation_certificate: "Centre Authorisation Certificate",
};

// remaining-compliance.md §5: three of the four are organisation-level
// ("one copy, read by every course"); the certificate is always per-centre
// ("approval is per centre, not per organisation").
export const ORG_LEVEL_DOC_TYPES: readonly CambridgeDocType[] = ["syllabus", "admin_handbook", "appeals_procedure"];

export interface CambridgeDocumentView {
  docType: CambridgeDocType;
  label: string;
  orgLevel: boolean;
  url: string | null;
  storagePath: string | null;
  scopeId: string; // organisation_id (org-level docs) or center_id (certificate)
  scopeIsOrg: boolean;
  /** Set when this slot is being answered by a Resource Hub upload rather
   *  than by a cambridge_documents row -- the reader is told which file. */
  fromHubTitle?: string | null;
}

// Which Resource Hub titles answer which slot.
//
// Ramy, 31 Aug 2026: the four named slots read cambridge_documents, which is
// empty in every centre, while the real documents sit in the Resource Hub
// beside them -- so a candidate saw "Not uploaded" four times with the
// Administration Handbook one section below. He chose to point the slots at
// the hub rather than keep a second register: "one place for a document, and
// you've already put them there."
//
// Matched on distinctive words rather than exact titles, because a centre
// names its own uploads and editions change -- "CELTA Administration
// Handbook (June 2025)" has to keep answering after June 2026 replaces it.
// Deliberately narrow: a slot with no confident match stays empty rather
// than showing a document that is not the one asked for.
const HUB_TITLE_PATTERNS: Record<CambridgeDocType, RegExp> = {
  syllabus: /syllabus/i,
  admin_handbook: /administration handbook/i,
  appeals_procedure: /appeals/i,
  authorisation_certificate: /authorisation certificate|approval certificate/i,
};

// Resolves the one shelf a centre actually sees: org-level docs from the
// centre's organisation if it has one, else falls back to that centre's
// own copy (a single-centre customer with no organisation record still
// needs somewhere to hold these) -- the certificate always from the centre
// itself, never the organisation.
export async function getCambridgeDocuments(
  supabase: SupabaseClient<Database>,
  centerId: string,
  organisationId: string | null,
  /**
   * Whose eyes these are for. A hub document carries its own
   * visible_to_trainee flag and most of the Cambridge set is staff-only, so
   * filling these slots from the hub must not become a way round that --
   * pass "trainee" and only trainee-visible uploads are considered.
   */
  audience: "staff" | "trainee" = "staff"
): Promise<CambridgeDocumentView[]> {
  const { data: rows } = organisationId
    ? await supabase.from("cambridge_documents").select("*").or(`organisation_id.eq.${organisationId},center_id.eq.${centerId}`)
    : await supabase.from("cambridge_documents").select("*").eq("center_id", centerId);

  const byOrgType = new Map((rows ?? []).filter((r) => r.organisation_id).map((r) => [r.doc_type, r]));
  const byCenterType = new Map((rows ?? []).filter((r) => r.center_id).map((r) => [r.doc_type, r]));

  // The hub is the fallback, only consulted for slots with no row of their
  // own -- an explicitly registered document still wins.
  let hubQuery = supabase
    .from("resources")
    .select("title, storage_path, file_url, visible_to_trainee")
    .eq("center_id", centerId)
    .eq("category", "forms");
  if (audience === "trainee") hubQuery = hubQuery.eq("visible_to_trainee", true);
  const { data: hubRows } = await hubQuery;

  return CAMBRIDGE_DOC_TYPES.map((docType) => {
    const isOrgLevel = ORG_LEVEL_DOC_TYPES.includes(docType);
    const orgRow = isOrgLevel && organisationId ? byOrgType.get(docType) : undefined;
    const row = orgRow ?? byCenterType.get(docType);
    const scopeIsOrg = Boolean(orgRow);

    // Newest first, so a hub holding two editions answers with the current
    // one -- titles carry their date, and a later edition sorts after.
    const hubMatch = row
      ? null
      : (hubRows ?? [])
          .filter((r) => HUB_TITLE_PATTERNS[docType].test(r.title))
          .sort((a, b) => b.title.localeCompare(a.title))[0];

    return {
      docType,
      label: CAMBRIDGE_DOC_LABELS[docType],
      orgLevel: isOrgLevel,
      url: row?.file_url ?? hubMatch?.file_url ?? null,
      storagePath: row?.storage_path ?? hubMatch?.storage_path ?? null,
      scopeId: scopeIsOrg ? organisationId! : centerId,
      scopeIsOrg,
      fromHubTitle: hubMatch?.title ?? null,
    };
  });
}
