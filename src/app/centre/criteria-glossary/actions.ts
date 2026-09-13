"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { glossaryEditorFor } from "@/lib/centre-glossary";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";
import { isBuiltInTerm } from "@/lib/criteria-glossary";

// Writes go through the service role after the capability check, the same
// shape the centre settings screen already uses -- there is deliberately no
// insert/update policy on the table. Every write leaves a footprint: who, the
// codes before, the codes after, and when (Ramy's standing rule for any
// management area more than one person can act on, and this one is open to
// every tutor at the centre as well as the Centre manager).

type Result = { error: string | null };

async function editor() {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) return null;
  return { profile, editor: await glossaryEditorFor(profile) };
}

function parseCodes(raw: string): { codes: string[]; unknown: string[] } {
  const codes = raw
    .split(/[\s,;·]+/)
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const unknown = codes.filter((c) => !CRITERIA_LABELS[c]);
  return { codes: [...new Set(codes)], unknown };
}

export async function saveGlossaryTerm(_prev: Result, formData: FormData): Promise<Result> {
  const ctx = await editor();
  if (!ctx?.editor) return { error: "You can't edit this centre's glossary." };
  const { centerId } = ctx.editor;

  const term = String(formData.get("term") ?? "").trim().toLowerCase();
  if (!term) return { error: "Write the word or phrase a tutor would type." };
  if (term.length > 60) return { error: "That's too long for a glossary term — keep it to a phrase." };

  const { codes, unknown } = parseCodes(String(formData.get("codes") ?? ""));
  if (codes.length === 0) return { error: "Give it at least one criterion code." };
  if (unknown.length > 0) {
    return { error: `Not a CELTA 5 code: ${unknown.join(", ")}. Use codes like 4b or 5f.` };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("center_criteria_terms")
    .select("id, criteria_codes, enabled")
    .eq("center_id", centerId)
    .eq("term", term)
    .maybeSingle();

  const before = existing?.criteria_codes ?? null;

  if (existing) {
    const { error } = await admin
      .from("center_criteria_terms")
      .update({ criteria_codes: codes, enabled: true, updated_by: ctx.profile.id, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from("center_criteria_terms").insert({
      center_id: centerId,
      term,
      criteria_codes: codes,
      enabled: true,
      created_by: ctx.profile.id,
      updated_by: ctx.profile.id,
    });
    if (error) return { error: error.message };
  }

  await admin.from("center_criteria_term_changes").insert({
    center_id: centerId,
    term,
    action: existing ? "edited" : "added",
    codes_before: before,
    codes_after: codes,
    changed_by: ctx.profile.id,
  });

  revalidatePath("/centre/criteria-glossary");
  return { error: null };
}

/** Switching a term off. On a built-in, that is how a centre stops it firing. */
export async function setGlossaryTermEnabled(formData: FormData): Promise<void> {
  const ctx = await editor();
  if (!ctx?.editor) return;
  const { centerId } = ctx.editor;

  const term = String(formData.get("term") ?? "").trim().toLowerCase();
  const enabled = formData.get("enabled") === "1";
  if (!term) return;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("center_criteria_terms")
    .select("id, criteria_codes")
    .eq("center_id", centerId)
    .eq("term", term)
    .maybeSingle();

  if (existing) {
    await admin
      .from("center_criteria_terms")
      .update({ enabled, updated_by: ctx.profile.id, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else if (!enabled && isBuiltInTerm(term)) {
    // Shadowing a built-in: the row exists only to say "not here".
    await admin.from("center_criteria_terms").insert({
      center_id: centerId,
      term,
      criteria_codes: [],
      enabled: false,
      created_by: ctx.profile.id,
      updated_by: ctx.profile.id,
    });
  } else {
    return;
  }

  await admin.from("center_criteria_term_changes").insert({
    center_id: centerId,
    term,
    action: enabled ? "enabled" : "disabled",
    codes_before: existing?.criteria_codes ?? null,
    codes_after: null,
    changed_by: ctx.profile.id,
  });

  revalidatePath("/centre/criteria-glossary");
}

/** Removes one of the centre's OWN terms. A built-in is switched off, not removed. */
export async function removeGlossaryTerm(formData: FormData): Promise<void> {
  const ctx = await editor();
  if (!ctx?.editor) return;
  const { centerId } = ctx.editor;

  const term = String(formData.get("term") ?? "").trim().toLowerCase();
  if (!term || isBuiltInTerm(term)) return;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("center_criteria_terms")
    .select("id, criteria_codes")
    .eq("center_id", centerId)
    .eq("term", term)
    .maybeSingle();
  if (!existing) return;

  await admin.from("center_criteria_terms").delete().eq("id", existing.id);
  await admin.from("center_criteria_term_changes").insert({
    center_id: centerId,
    term,
    action: "removed",
    codes_before: existing.criteria_codes,
    codes_after: null,
    changed_by: ctx.profile.id,
  });

  revalidatePath("/centre/criteria-glossary");
}
