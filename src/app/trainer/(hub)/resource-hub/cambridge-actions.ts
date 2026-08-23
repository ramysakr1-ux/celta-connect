"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { CAMBRIDGE_DOC_TYPES, ORG_LEVEL_DOC_TYPES, type CambridgeDocType } from "@/lib/cambridge-documents";

export interface CambridgeDocState {
  error: string | null;
}

// "One current version; editing changes what both branches do" -- careful
// enough to gate on the same centre.settings.edit capability every other
// centre-wide administrative change already uses, checked here rather than
// via RLS (an app-layer capability, not something SQL can evaluate) --
// cambridge_documents itself has no insert/update policy at all, matching
// centre_roles' own "self-service is exactly what's forbidden" precedent.
export async function uploadCambridgeDocument(_prevState: CambridgeDocState, formData: FormData): Promise<CambridgeDocState> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile || profile.role !== "admin") return { error: "Only a centre admin can update this." };

  const docType = formData.get("doc_type") as string | null;
  if (!docType || !CAMBRIDGE_DOC_TYPES.includes(docType as CambridgeDocType)) {
    return { error: "Something went wrong. Refresh and try again." };
  }

  const ctx = await getCentreRoleContext(profile);
  if (!can(ctx.roles, "centre.settings.edit", ctx.overrides)) {
    return { error: "You don't hold a role that can edit centre settings." };
  }

  const admin = createAdminClient();
  const centerId = ctx.activeCenterId ?? profile.center_id;
  const { data: center } = await admin.from("centers").select("organisation_id").eq("id", centerId).maybeSingle();
  if (!center) return { error: "Centre not found." };

  const isOrgLevel = ORG_LEVEL_DOC_TYPES.includes(docType as CambridgeDocType) && center.organisation_id;
  const scopeId = isOrgLevel ? center.organisation_id! : centerId;

  const file = formData.get("file");
  const link = (formData.get("link") as string | null)?.trim() || null;
  let storagePath: string | null = null;
  let fileUrl: string | null = link;

  if (file instanceof File && file.size > 0) {
    const path = `cambridge/${scopeId}/${docType}-${Date.now()}.${file.name.split(".").pop() ?? "pdf"}`;
    const { error: uploadError } = await admin.storage
      .from("resource-hub-files")
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true });
    if (uploadError) return { error: "Could not upload the file. Try again." };
    storagePath = path;
    fileUrl = null;
  }

  if (!storagePath && !fileUrl) return { error: "Attach a file or paste a link." };

  const { error } = await admin.from("cambridge_documents").upsert(
    {
      organisation_id: isOrgLevel ? scopeId : null,
      center_id: isOrgLevel ? null : scopeId,
      doc_type: docType as CambridgeDocType,
      file_url: fileUrl,
      storage_path: storagePath,
      uploaded_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: isOrgLevel ? "organisation_id,doc_type" : "center_id,doc_type" }
  );
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/trainer/resource-hub");
  revalidatePath("/portfolio", "layout");
  return { error: null };
}
