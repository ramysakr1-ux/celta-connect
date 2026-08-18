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
}

// Resolves the one shelf a centre actually sees: org-level docs from the
// centre's organisation if it has one, else falls back to that centre's
// own copy (a single-centre customer with no organisation record still
// needs somewhere to hold these) -- the certificate always from the centre
// itself, never the organisation.
export async function getCambridgeDocuments(
  supabase: SupabaseClient<Database>,
  centerId: string,
  organisationId: string | null
): Promise<CambridgeDocumentView[]> {
  const { data: rows } = organisationId
    ? await supabase.from("cambridge_documents").select("*").or(`organisation_id.eq.${organisationId},center_id.eq.${centerId}`)
    : await supabase.from("cambridge_documents").select("*").eq("center_id", centerId);

  const byOrgType = new Map((rows ?? []).filter((r) => r.organisation_id).map((r) => [r.doc_type, r]));
  const byCenterType = new Map((rows ?? []).filter((r) => r.center_id).map((r) => [r.doc_type, r]));

  return CAMBRIDGE_DOC_TYPES.map((docType) => {
    const isOrgLevel = ORG_LEVEL_DOC_TYPES.includes(docType);
    const orgRow = isOrgLevel && organisationId ? byOrgType.get(docType) : undefined;
    const row = orgRow ?? byCenterType.get(docType);
    const scopeIsOrg = Boolean(orgRow);
    return {
      docType,
      label: CAMBRIDGE_DOC_LABELS[docType],
      orgLevel: isOrgLevel,
      url: row?.file_url ?? null,
      storagePath: row?.storage_path ?? null,
      scopeId: scopeIsOrg ? organisationId! : centerId,
      scopeIsOrg,
    };
  });
}
