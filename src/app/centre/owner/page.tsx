import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { computeCourseState } from "@/lib/course-progress";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { roleLabel, CAPABILITY_LABELS, type Capability } from "@/lib/auth/centre-permissions";
import { CapabilityCustomizer } from "@/app/centre/owner/capability-customizer";
import { BranchVisibilityCard } from "@/app/centre/owner/branch-visibility-card";
import { TransferOwnershipCard, DeleteCentreCard } from "@/app/centre/settings/danger-zone";

// for-claude-code-centre-owner-role-customizer.md: "This screen is
// deliberately a different register from the rest of Connect... signals
// 'this surface carries real weight,' not a fifth tab that happens to look
// the same." Ink + garnet, a dark header band, warmer parchment field --
// see Centre Owner Landing.dc.html for the exact tokens.
export default async function CentreOwnerPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  if (!ctx.roles.includes("centre_owner")) redirect("/centre");

  // The header carries a branch filter (Centre Management's own, from the
  // shared layout) and this page ignored it -- so it read "All branches"
  // while every figure below was one branch's, and the eyebrow named that
  // branch. Ramy saw exactly that on a screen whose whole premise is owning
  // more than one centre.
  //
  // Two different scopes, deliberately:
  //   - The FIGURES answer "how is my centre doing", so they follow the
  //     filter and total across every branch when it says All branches.
  //   - The ROLE BUILDER, custom roles, branch visibility and the overrides
  //     are per-centre rows. There is no such thing as editing "all
  //     branches'" permissions at once, so those stay on one branch and the
  //     card now says which.
  const { branch } = await searchParams;
  const mine = ctx.availableCenterIds.filter(Boolean);
  const scope = branch && mine.includes(branch) ? [branch] : mine.length > 0 ? mine : [profile.center_id];
  const aggregated = scope.length > 1;
  const centerId = branch && mine.includes(branch) ? branch : (ctx.activeCenterId ?? profile.center_id);
  const admin = createAdminClient();

  // Ramy, 27 Aug 2026 (round 2): every query below only needs centerId,
  // already known at this point -- getCachedCenter (time zone), the centers
  // row (name/organisation_id, separate from getCachedCenter since that one
  // doesn't select organisation_id), courses, grants, owner-actions, and the
  // custom-role/capability pair (previously a THIRD sequential Promise.all,
  // run after the plans/people/payments chain below for no reason) all used
  // to run in up to 4 sequential stages.
  const [
    cachedCenter,
    { data: center },
    { data: courses },
    { data: grants },
    { data: ownerActions },
    { data: customRoles },
    { data: customCapabilities },
    { data: scopeCentres },
  ] =
    await Promise.all([
      getCachedCenter(centerId),
      admin.from("centers").select("id, name, organisation_id, currency").eq("id", centerId).maybeSingle(),
      admin.from("courses").select("id, start_date, end_date").in("center_id", scope),
      admin.from("centre_roles").select("id, profile_id, role, center_id").in("center_id", scope).is("revoked_at", null),
      admin.from("centre_owner_actions").select("id, created_at").in("center_id", scope),
      admin.from("centre_custom_roles").select("role_key, label").eq("center_id", centerId),
      admin.from("centre_custom_capabilities").select("capability_key, label").eq("center_id", centerId),
      // Names for every branch in scope. Built from the scope itself, not
      // from organisation siblings: a branch that shares an owner but not an
      // organisation_id is invisible to that query, and the fallback then
      // printed the CURRENT centre's name against its rows -- so Diane's Los
      // Angeles grant read "Connect CELTA New York".
      // `mine`, not `scope`: the custodial cards below act on the centre this
      // owner is signed in against, which the branch filter does not move, so
      // its name has to be resolvable even while the page is filtered to a
      // different branch.
      admin.from("centers").select("id, name").in("id", mine.length > 0 ? mine : [centerId]),
    ]);

  const timeZone = cachedCenter?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);

  const courseIds = (courses ?? []).map((c) => c.id);
  const coursesRunning = (courses ?? []).filter((c) => computeCourseState(c.start_date, c.end_date, today) === "running").length;

  const grantProfileIds = [...new Set((grants ?? []).map((g) => g.profile_id))];

  // Cross-branch visibility only matters when this centre's organisation
  // actually has more than one branch. `siblings` only needs
  // center.organisation_id (already resolved above), so it runs alongside
  // plans/people rather than waiting for that unrelated chain to finish.
  const [{ data: plans }, { data: people }, { data: siblings }] = await Promise.all([
    courseIds.length ? admin.from("payment_plans").select("id, course_id").in("course_id", courseIds) : Promise.resolve({ data: [] }),
    grantProfileIds.length
      ? admin.from("profiles").select("id, full_name, course_id").in("id", grantProfileIds)
      : Promise.resolve({ data: [] }),
    center?.organisation_id
      ? admin.from("centers").select("id, name").eq("organisation_id", center.organisation_id).neq("id", centerId)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  // "Who holds what" spans branches now, so each row names its own -- the
  // column used to print the current centre's name against every row.
  const branchNameById = new Map<string, string>((scopeCentres ?? []).map((b) => [b.id, b.name]));
  // Transferring ownership and deleting a centre run against
  // ctx.activeCenterId, which the ?branch filter deliberately does not
  // change -- so with the filter on Los Angeles, the delete card was still
  // pointed at New York. Naming the real target here is what makes the
  // type-the-name confirmation mean something: you type the name of the
  // centre that will actually be destroyed.
  const custodialId = ctx.activeCenterId ?? profile.center_id;
  const custodialName = branchNameById.get(custodialId) ?? center?.name ?? "this centre";
  const custodialIsElsewhere = custodialId !== centerId;

  const planIds = (plans ?? []).map((p) => p.id);
  const siblingBranches = siblings ?? [];

  // payments (needs planIds) and branch visibility (needs siblingBranches)
  // are independent of each other -- run together, not one after the other.
  const [{ data: payments }, { data: vis }] = await Promise.all([
    planIds.length
      ? admin.from("payments").select("amount, status, payment_plan_id").in("payment_plan_id", planIds)
      : Promise.resolve({ data: [] }),
    siblingBranches.length > 0
      ? admin
          .from("centre_branch_visibility")
          .select("viewer_center_id, target_center_id, visibility")
          .in("viewer_center_id", [centerId, ...siblingBranches.map((b) => b.id)])
          .in("target_center_id", [centerId, ...siblingBranches.map((b) => b.id)])
      : Promise.resolve({ data: [] as { viewer_center_id: string; target_center_id: string; visibility: string }[] }),
  ]);
  const visibilityRows = vis ?? [];
  const outstandingBalance = (payments ?? [])
    .filter((p) => p.status === "pending" || p.status === "missed")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const peopleWithRole = new Set((grants ?? []).map((g) => g.profile_id)).size;

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const ownerActionsThisMonth = (ownerActions ?? []).filter((a) => a.created_at >= monthStart).length;

  const capabilityRows: { key: string; label: string }[] = [
    ...(Object.keys(CAPABILITY_LABELS) as Capability[]).map((key) => ({ key: key as string, label: CAPABILITY_LABELS[key] })),
    ...(customCapabilities ?? []).map((c) => ({ key: c.capability_key, label: c.label })),
  ];

  return (
    <div className="owner-surface -m-6 flex flex-col">
      <div className="owner-header flex items-start justify-between gap-6 px-11 py-9">
        <div>
          <p className="owner-eyebrow" style={{ color: "oklch(78% 0.03 75)" }}>
            {aggregated
              ? `All branches · ${scope.length} centres`
              : `${siblingBranches.length > 0 ? `${siblingBranches.length + 1} branches · ` : ""}${center?.name ?? "Your centre"}`}
          </p>
          <h1 className="owner-serif mt-2 text-[33px] font-semibold text-[oklch(98%_0.008_85)]">Centre owner</h1>
          <p className="mt-2 max-w-[480px] text-[13px] leading-relaxed text-[oklch(74%_0.025_75)]">
            Full oversight, custodial powers over every course, and the ability to shape exactly how each role at
            your centre works.
          </p>
        </div>
        {/* The pill used to repeat the words already set in 33px serif a
            few pixels to its left. Ramy, 1 Sep 2026: "there's a big Centre
            owner writing on the left in the black screen. So instead of
            'Centre owner' lying on the right inside the red pill, we keep
            the red pill, and we write down the centre owner's name."
            The role is the heading; the pill is who holds it. */}
        <span className="owner-pill owner-pill-name owner-serif shrink-0">{profile.full_name}</span>
      </div>

      <div className="flex flex-col gap-[30px] px-11 py-9">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <StatCard label="Courses running" value={String(coursesRunning)} />
          <StatCard label="Outstanding balance" value={formatMoney(outstandingBalance, center?.currency)} accent />
          <StatCard label="People with a centre role" value={String(peopleWithRole)} />
          <StatCard label="Owner actions logged" value={String(ownerActionsThisMonth)} suffix="this month" />
        </div>

        {siblingBranches.length > 0 ? (
          <BranchVisibilityCard centerId={centerId} centerName={center?.name ?? "This branch"} siblings={siblingBranches} visibilityRows={visibilityRows} />
        ) : null}

        {/* Permissions are per-centre rows, so there is no editing "all
            branches" at once. When the figures above are totalling several,
            say plainly which one these pills apply to. */}
        {aggregated ? (
          <p className="-mb-4 text-[11.5px]" style={{ color: "var(--owner-muted)" }}>
            Roles and permissions below apply to <strong>{center?.name ?? "this branch"}</strong>. Pick a branch in
            the header to configure another.
          </p>
        ) : null}
        <CapabilityCustomizer overrides={ctx.overrides} customRoles={customRoles ?? []} capabilityRows={capabilityRows} />

        <div className="owner-card flex flex-col gap-4 px-7 py-6">
          <h2 className="owner-serif text-[19px]">Who holds what</h2>
          <div className="flex flex-col">
            {(grants ?? []).map((g, i) => (
              <div
                key={g.id}
                className={`owner-row-hover grid grid-cols-3 items-center gap-2.5 rounded px-3 py-3 ${i > 0 ? "border-t" : ""}`}
                style={{ borderColor: "var(--owner-line)" }}
              >
                <span className="text-[12.5px] font-semibold">{nameById.get(g.profile_id) ?? "Unknown"}</span>
                <span className="text-[11.5px] font-semibold" style={{ color: "var(--owner-garnet)" }}>
                  {roleLabel(g.role, customRoles ?? [])}
                </span>
                <span className="text-[11px]" style={{ color: "var(--owner-muted)" }}>
                  {branchNameById.get(g.center_id) ?? ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ramy, 1 Sep 2026: "the danger zone should also be inside the
            centre owner's page." It was the only owner-gated thing in
            Centre Management's Settings -- a custodial power filed under
            configuration. Transferring or destroying a centre is exactly
            what this screen is for. */}
        <div className="owner-card flex flex-col gap-4 px-7 py-6" style={{ borderTop: "3px solid var(--owner-garnet)" }}>
          <div className="flex flex-col gap-1">
            <h2 className="owner-serif text-[19px]">Danger zone</h2>
            <p className="text-[12.5px]" style={{ color: "var(--owner-muted)" }}>
              {custodialIsElsewhere ? (
                <>
                  These act on <strong>{custodialName}</strong>, the centre you are signed in against &mdash; not on the
                  branch shown above. Neither can be undone.
                </>
              ) : (
                <>
                  These act on <strong>{custodialName}</strong>, and neither can be undone.
                </>
              )}
            </p>
          </div>
          <TransferOwnershipCard centreName={custodialName} />
          <DeleteCentreCard centreName={custodialName} />
        </div>
      </div>

      <style>{`
        .owner-surface {
          --owner-ink: oklch(20% 0.014 55);
          --owner-garnet: oklch(42% 0.15 27);
          --owner-garnet-soft: oklch(42% 0.15 27 / 0.08);
          --owner-parchment: oklch(94% 0.014 78);
          --owner-paper: oklch(99% 0.006 80);
          --owner-line: oklch(85% 0.018 75);
          --owner-muted: oklch(48% 0.02 65);
          background: var(--owner-parchment);
          color: var(--owner-ink);
        }
        .owner-header { background: var(--owner-ink); border-bottom: 3px solid var(--owner-garnet); }
        .owner-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
        .owner-serif { font-family: var(--font-serif, "Newsreader", Georgia, serif); }
        .owner-pill {
          display: inline-flex; align-items: center; gap: 7px; padding: 7px 16px; border-radius: 3px;
          background: var(--owner-garnet); color: oklch(98% 0.006 85); font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
        }
        /* A person's name is not a label: dropping the caps and the tracking,
           and setting it in the serif at reading size, is what stops it
           reading as another badge and starts it reading as someone. */
        .owner-pill-name {
          padding: 9px 18px; font-size: 15px; font-weight: 600;
          letter-spacing: 0.005em; text-transform: none;
        }
        .owner-card {
          background: var(--owner-paper); border: 1px solid var(--owner-line); border-radius: 10px;
          border-top: 3px solid var(--owner-garnet);
          box-shadow: 0 1px 2px rgba(30,15,10,0.03), 0 14px 32px -20px rgba(30,15,10,0.28);
        }
        .owner-row-hover { transition: background-color 0.12s ease; }
        /* Was --owner-garnet-soft, an 8% wash you had to look for. The
           shared fill is the same one every other surface uses, so a row
           here highlights as firmly as a row anywhere else. */
        .owner-row-hover:hover { background-color: var(--area-hover-fill, var(--owner-garnet-soft)); }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, suffix, accent }: { label: string; value: string; suffix?: string; accent?: boolean }) {
  return (
    <div
      className="owner-card px-5 py-[18px]"
      style={{ borderTop: "1px solid var(--owner-line)", borderLeft: "3px solid var(--owner-garnet)" }}
    >
      <p className="owner-eyebrow" style={{ color: "var(--owner-muted)" }}>
        {label}
      </p>
      <p className="owner-serif mt-[7px] text-[28px] tabular-nums" style={accent ? { color: "var(--owner-garnet)" } : undefined}>
        {value}
        {suffix ? <span className="ml-1 text-xs font-sans font-normal" style={{ color: "var(--owner-muted)" }}>{suffix}</span> : null}
      </p>
    </div>
  );
}

// Was hard-coded to GBP, so a New York centre's balance read in sterling.
// centers.currency is the centre's own; sterling stays the fallback for a
// centre that has not set one rather than guessing from the address.
function formatMoney(amount: number, currency: string | null | undefined): string {
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : "GBP";
  return new Intl.NumberFormat(code === "USD" ? "en-US" : "en-GB", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(amount);
}
