import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { ProviderList } from "@/app/centre/payments/provider-list";
import type { PaymentProviderKey } from "@/lib/payments/providers";

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
      />

      <p className="text-xs leading-relaxed text-muted">
        One currency per course, set by the centre. Card is one of four accepted methods and is never required. Card
        payments show as <span className="text-ink">Confirmed</span> because the provider verified them; every other
        method shows <span className="text-ink">Marked by</span> whoever recorded it.
      </p>
    </div>
  );
}
