import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

const CARD = "oklch(0.992 0.005 90)";
const INK = "oklch(0.235 0.017 65)";
const MUTED = "oklch(0.51 0.017 70)";
const BORDER = "oklch(0.895 0.012 82)";
const SAND = "oklch(0.935 0.012 82)";
const GOLD = "oklch(0.63 0.096 72)";
const GREEN = "oklch(0.5 0.11 155)";
const RED = "oklch(0.58 0.16 25)";
const DARK = "oklch(0.14 0.012 60)";

function money(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// command-center-full-spec.md's Money section -- billing is Connect's own
// ledger, platform-wide regardless of Owner/Invited access, same rule
// /platform/accounts and Overview's "Needs your attention" already use.
//
// "Connected to Stripe" in the mockup is honestly not true of this app --
// centre_invoices/centre_subscriptions are recorded by hand today
// (/platform/accounts' own manual forms), no Stripe integration exists at
// the platform-billing level (a centre's own payment_provider is a
// different, centre-scoped thing -- collecting from their candidates, not
// Connect billing the centre). Shown disconnected rather than faked.
export default async function CommandCenterMoneyPage() {
  await requireRole("platform_owner");
  const admin = createAdminClient();

  const [{ data: centers }, { data: invoices }] = await Promise.all([
    admin.from("centers").select("id, name"),
    admin.from("centre_invoices").select("*").order("created_at", { ascending: false }),
  ]);
  const centerNameById = new Map((centers ?? []).map((c) => [c.id, c.name]));
  const invoicesList = invoices ?? [];

  const now = new Date();
  const collectedThisMonth = new Map<string, number>();
  const outstanding = new Map<string, number>();
  for (const inv of invoicesList) {
    if (inv.status === "paid" && inv.paid_at) {
      const paidAt = new Date(inv.paid_at);
      if (paidAt.getFullYear() === now.getFullYear() && paidAt.getMonth() === now.getMonth()) {
        collectedThisMonth.set(inv.currency, (collectedThisMonth.get(inv.currency) ?? 0) + inv.amount);
      }
    }
    if (inv.status === "outstanding") {
      outstanding.set(inv.currency, (outstanding.get(inv.currency) ?? 0) + inv.amount);
    }
  }

  const OVERDUE_DAYS = 7;
  const overdueCutoff = new Date();
  overdueCutoff.setDate(overdueCutoff.getDate() - OVERDUE_DAYS);

  const recent = invoicesList.slice(0, 10);

  return (
    <div style={{ background: CARD, borderRadius: 10, boxShadow: "rgba(30,20,10,0.04) 0 1px 2px", padding: 20, display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "Newsreader, serif", fontSize: 17, fontWeight: 600, color: INK }}>Billing &amp; payments</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: MUTED }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: MUTED }} />
          Not connected
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: "12px 14px", borderRadius: 7, background: SAND, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>Collected this month</div>
          <div style={{ fontFamily: "Newsreader, serif", fontSize: 21, fontWeight: 600, color: INK }}>
            {collectedThisMonth.size === 0 ? "—" : [...collectedThisMonth.entries()].map(([c, a]) => money(a, c)).join(" · ")}
          </div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 7, background: `color-mix(in oklab, ${GOLD} 10%, ${CARD})`, border: `1px solid color-mix(in oklab, ${GOLD} 26%, transparent)`, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: GOLD }}>Outstanding</div>
          <div style={{ fontFamily: "Newsreader, serif", fontSize: 21, fontWeight: 600, color: INK }}>
            {outstanding.size === 0 ? "—" : [...outstanding.entries()].map(([c, a]) => money(a, c)).join(" · ")}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "oklch(0.58 0.017 70)", paddingBottom: 8 }}>Recent transactions</div>
        {recent.length === 0 ? (
          <p style={{ fontSize: 12.5, color: MUTED }}>Nothing recorded yet.</p>
        ) : (
          recent.map((inv) => {
            const isOverdue = inv.status === "outstanding" && inv.due_date && new Date(inv.due_date) < overdueCutoff;
            return (
              <div key={inv.id} className="admin-hover" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 0", borderTop: `1px solid ${BORDER}` }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{centerNameById.get(inv.center_id) ?? "Unknown centre"}</div>
                  <div style={{ fontSize: 11, color: "oklch(0.58 0.017 70)" }}>{inv.note ?? (inv.status === "paid" ? "Course fee" : "Invoice")}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "0 0 auto" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{money(inv.amount, inv.currency)}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: inv.status === "paid" ? GREEN : isOverdue ? RED : MUTED }}>
                    {inv.status === "paid" ? "PAID" : isOverdue ? "OVERDUE" : inv.status.toUpperCase()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
        No Stripe (or other payment processor) connection exists for platform billing yet — invoices above are recorded by hand.
      </p>
      <div
        style={{ textAlign: "center", padding: "12px 16px", borderRadius: 6, background: GOLD, color: DARK, fontSize: 12.5, fontWeight: 700, cursor: "not-allowed", opacity: 0.6 }}
        title="Not built yet"
      >
        Connect to Stripe
      </div>
      <Link href="/platform/accounts" style={{ fontSize: 11, fontWeight: 600, color: "oklch(0.58 0.017 70)", textDecoration: "none" }}>
        Manage subscriptions &amp; invoices →
      </Link>
    </div>
  );
}
