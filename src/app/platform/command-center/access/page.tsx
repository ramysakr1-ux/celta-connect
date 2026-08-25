import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { DemoLinksCard, type ActiveLinkRow } from "@/app/platform/command-center/access/demo-links-card";

export default async function CommandCenterAccessPage() {
  await requireRole("platform_owner");
  const admin = createAdminClient();

  const [{ data: centers }, { data: links }] = await Promise.all([
    admin.from("centers").select("id, name").order("name", { ascending: true }),
    admin
      .from("platform_demo_login_links")
      .select("id, center_id, role_key, login_token, expires_at, revoked_at")
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const centerNameById = new Map((centers ?? []).map((c) => [c.id, c.name]));
  const activeLinks: ActiveLinkRow[] = (links ?? []).map((l) => ({
    id: l.id,
    centreName: centerNameById.get(l.center_id) ?? "Unknown centre",
    roleKey: l.role_key,
    loginToken: l.login_token,
    expiresAt: l.expires_at,
  }));

  return <DemoLinksCard centres={(centers ?? []).map((c) => ({ id: c.id, name: c.name }))} activeLinks={activeLinks} />;
}
