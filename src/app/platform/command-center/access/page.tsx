import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { DemoLinksCard, type ActiveLinkRow } from "@/app/platform/command-center/access/demo-links-card";

export default async function CommandCenterAccessPage() {
  await requireRole("platform_owner");
  const admin = createAdminClient();

  const [{ data: centers }, { data: links }] = await Promise.all([
    admin.from("centers").select("id, name, is_demo").order("name", { ascending: true }),
    admin
      .from("platform_demo_login_links")
      .select("id, center_id, role_key, login_token, expires_at, revoked_at")
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  // Every centre names the rows in the active list -- including a live one a
  // link was generated for before this was restricted -- so nothing already
  // issued displays as "Unknown centre".
  const centerNameById = new Map((centers ?? []).map((c) => [c.id, c.name]));
  const activeLinks: ActiveLinkRow[] = (links ?? []).map((l) => ({
    id: l.id,
    centreName: centerNameById.get(l.center_id) ?? "Unknown centre",
    roleKey: l.role_key,
    loginToken: l.login_token,
    expiresAt: l.expires_at,
  }));

  // But only demo centres can be CHOSEN. The dropdown used to list every
  // centre, so you could generate a link for a live one that redemption can
  // only ever refuse -- a control offering something it will not do. Ramy,
  // 3 Sep 2026: "Access only creates magic links, not real invites."
  const selectable = (centers ?? []).filter((c) => c.is_demo).map((c) => ({ id: c.id, name: c.name }));

  return <DemoLinksCard centres={selectable} activeLinks={activeLinks} />;
}
