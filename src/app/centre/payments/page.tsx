import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { ProviderList } from "@/app/centre/payments/provider-list";
import type { PaymentProviderKey } from "@/lib/payments/providers";
import { RefundsPanel, type RefundRow } from "@/app/centre/payments/refunds-panel";

// Centre settings > payment providers (spec 2026-08-16, Payments.dc.html 1c).
// Reached from the "payment providers" link in Centre Admin's settings bar.
export default async function PaymentProvidersPage() {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  // Read-only roles have no business on a screen whose only purpose is to
  // change where a centre's money goes.
  if (!can(ctx.roles, "centre.settings.edit")) redirect("/centre");

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const supabase = await createClient();
  const { data: center } = await supabase
    .from("centers")
    .select("name, payment_provider, payment_provider_connected_at")
    .eq("id", centerId)
    .maybeSingle();

  // Checked server-side so the light tells the truth: Stripe can be "connected"
  // on paper while the server has no key, in which case the first real checkout
  // throws. Only the boolean crosses to the client -- never the key itself.
  const credentialsPresent =
    center?.payment_provider === "stripe" ? Boolean(process.env.STRIPE_SECRET_KEY) : false;

  const { data: refunds } = await supabase
    .from("refunds")
    .select("id, amount, currency, reason, status, settlement, agreed_at, applicant_id")
    .eq("center_id", profile.center_id)
    .order("agreed_at", { ascending: false })
    .limit(40);

  // Names for the rows that have an applicant. A refund can also stand alone
  // (a deposit taken before anyone applied through Connect), so this is a
  // lookup, not a join.
  const refundApplicantIds = [...new Set((refunds ?? []).map((r) => r.applicant_id).filter(Boolean))] as string[];
  const { data: refundApplicants } = refundApplicantIds.length
    ? await supabase.from("applicants").select("id, full_name").in("id", refundApplicantIds)
    : { data: [] };
  const refundName = new Map((refundApplicants ?? []).map((a) => [a.id, a.full_name]));

  const refundRows: RefundRow[] = (refunds ?? []).map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    currency: r.currency,
    reason: r.reason,
    status: r.status,
    settlement: r.settlement,
    agreedAt: r.agreed_at,
    ageDays: Math.floor((Date.now() - new Date(r.agreed_at).getTime()) / 86400000),
    applicantName: r.applicant_id ? (refundName.get(r.applicant_id) ?? null) : null,
  }));

  return (
    <div className="flex max-w-[720px] flex-col gap-5">
      <div>
        <Link href="/centre" className="text-sm text-muted hover:text-ink">
          &larr; Centre admin
        </Link>
        <h1 className="mt-2 font-serif text-[26px] text-ink">Payment providers</h1>
        <p className="mt-1 text-[13px] text-muted">
          Connect {center?.name ?? "your centre"}&apos;s own provider account so card becomes one of the methods you
          accept. Card is optional — bank transfer, cash and employer or sponsor invoice work without it.
        </p>
      </div>

      <ProviderList
        connectedKey={(center?.payment_provider ?? null) as PaymentProviderKey | null}
        connectedAt={center?.payment_provider_connected_at ?? null}
        credentialsPresent={credentialsPresent}
      />

      <RefundsPanel refunds={refundRows} canEdit={can(ctx.roles, "payments.edit")} />

      <p className="text-xs leading-relaxed text-muted">
        One currency per course, set by the centre. Card is one of four accepted methods and is never required. Card
        payments show as <span className="text-ink">Confirmed</span> because the provider verified them; every other
        method shows <span className="text-ink">Marked by</span> whoever recorded it.
      </p>
    </div>
  );
}
