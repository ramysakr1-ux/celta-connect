import "server-only";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { landingFor, adminHomePath } from "@/lib/auth/centre-permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Shared by /dashboard (the role-router landing page) and signIn (login/
// actions.ts) -- pulled out so signIn can redirect straight to the real
// destination instead of bouncing through /dashboard as an extra hop that
// re-fetches the profile and re-runs this same logic. See the SS1.1c
// architecture-plan routing rules this encodes; kept verbatim from
// dashboard/page.tsx, not re-derived.
export async function resolveLandingPath(profile: Profile): Promise<string> {
  if (profile.role === "trainer") return "/trainer";
  if (profile.role === "trainee") return `/portfolio/${profile.id}`;

  if (profile.role === "platform_owner") {
    if (profile.course_id) {
      const admin = createAdminClient();
      const { data: link } = await admin
        .from("course_tutors")
        .select("id")
        .eq("course_id", profile.course_id)
        .eq("profile_id", profile.id)
        .is("left_at", null)
        .maybeSingle();
      if (link) return "/trainer";
    }
    return "/platform/command-center";
  }

  if (profile.role === "admin") {
    const ctx = await getCentreRoleContext(profile);
    // adminHomePath, not a second copy of the rule. This function had its
    // own version that never mentioned centre_owner, so signing in as an
    // owner landed you in Centre Management while the Connect mark -- which
    // does use adminHomePath -- took you to /centre/owner. Two functions,
    // two answers to "where is home", and the one that ran first won.
    //
    // Ramy, 1 Sep 2026, after we had rebuilt the owner's landing page:
    // "it's not the landing page for the centre owner... so it's the wrong
    // page." It was: he was being landed somewhere else entirely.
    if (ctx.roles.length > 0) return adminHomePath(ctx.roles);
  }

  return `/dashboard/${profile.role}`;
}
