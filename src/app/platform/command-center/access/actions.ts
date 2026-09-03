"use server";

import "server-only";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_KEYS, type DemoLoginRoleKey } from "@/app/platform/command-center/access/role-keys";

export interface GenerateLinkState {
  error: string | null;
}

// for-claude-code-demo-login-links.md: real persistence, real 24h expiry,
// real revoke, real audit (created_by/created_at) -- generating one is
// genuinely logged, matching "generating one here is always logged."
// Redemption is real as of 3 Sep 2026 -- see demo-login/[token]/route.ts --
// and is scoped to demo centres, which is what this action now enforces too.
export async function generateDemoLoginLink(_prev: GenerateLinkState, formData: FormData): Promise<GenerateLinkState> {
  const profile = await requireRole("platform_owner");
  const centerId = formData.get("center_id");
  const roleKey = formData.get("role_key");

  if (typeof centerId !== "string" || !centerId) return { error: "Choose a centre." };
  if (typeof roleKey !== "string" || !ROLE_KEYS.includes(roleKey as DemoLoginRoleKey)) return { error: "Choose a role." };

  const admin = createAdminClient();

  // Checked here, not just filtered out of the dropdown: the centre id
  // arrives in a form post, so the restriction has to hold against a posted
  // value the UI never offered.
  const { data: centre } = await admin.from("centers").select("is_demo").eq("id", centerId).maybeSingle();
  if (!centre) return { error: "That centre no longer exists." };
  if (!centre.is_demo) return { error: "Demo centres only — these links sign someone in without an account." };

  // Ramy, 3 Sep 2026: "can I create, like, a permanent one or only magic
  // one?" Three lifetimes now, 24h still the default. "Permanent" is a date
  // a century out rather than a null, because every query here filters on
  // expires_at > now and a null would drop the row out of its own list.
  // Revoking still works on it, which is what actually ends a link.
  const lifetime = formData.get("lifetime");
  const hours = lifetime === "week" ? 24 * 7 : lifetime === "permanent" ? null : 24;
  const expiresAt =
    hours === null
      ? (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() + 100);
          return d.toISOString();
        })()
      : new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("platform_demo_login_links").insert({
    center_id: centerId,
    role_key: roleKey,
    login_token: randomUUID(),
    created_by: profile.id,
    expires_at: expiresAt,
  });
  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[platform/command-center/access:generateDemoLoginLink]", error);
    return { error: "Could not generate the link. Try again." };
  }

  revalidatePath("/platform/command-center/access");
  return { error: null };
}

export async function revokeDemoLoginLink(linkId: string): Promise<{ error: string | null }> {
  await requireRole("platform_owner");
  const admin = createAdminClient();
  const { error } = await admin.from("platform_demo_login_links").update({ revoked_at: new Date().toISOString() }).eq("id", linkId);
  if (error) {
    // The message above is what the person reads; this is what we read.
    console.error("[platform/command-center/access:revokeDemoLoginLink]", error);
    return { error: "Could not revoke the link. Try again." };
  }
  revalidatePath("/platform/command-center/access");
  return { error: null };
}
