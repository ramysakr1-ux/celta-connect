import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can, canView, CENTRE_ROLE_LABELS } from "@/lib/auth/centre-permissions";

// Centre Admin's Overview tab (for-claude-code-centre-admin-full.md):
// "Financial summary strip, all courses across the centre, admissions pipeline
// stage counts, a payments-needing-attention list, and the volunteer pool."
//
// This is the money-and-oversight landing, deliberately NOT /dashboard/admin --
// that screen is Course Admin's (its own handoff calls it "the CELTA main
// course tutor's own credentials"), and the specs are explicit the two must
// never be merged.
export default async function CentreOverviewPage() {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length === 0) redirect("/dashboard");

  const centerId = ctx.activeCenterId ?? profile.center_id;
  const supabase = await createClient();

  const [{ data: center }, { data: courses }, { data: applicants }, { data: payments }] = await Promise.all([
    supabase.from("centers").select("name, center_number").eq("id", centerId).maybeSingle(),
    supabase.from("courses").select("id, name, start_date, end_date, delivery_mode").eq("center_id", centerId).order("start_date", { ascending: false }),
    canView(ctx.roles, "admissions.view")
      ? supabase.from("applicants").select("stage, deposit_amount, deposit_paid_at").eq("center_id", centerId)
      : Promise.resolve({ data: [] }),
    canView(ctx.roles, "payments.view")
      ? supabase.from("payments").select("amount, currency, status, due_date, paid_at").eq("center_id", centerId)
      : Promise.resolve({ data: [] }),
  ]);

  // volunteer_students is scoped by course, not centre -- it carries a
  // course_id and no center_id -- so the pool has to come via this centre's
  // courses rather than a direct filter.
  const courseIds = (courses ?? []).map((c) => c.id);
  const { data: volunteers } =
    canView(ctx.roles, "volunteers.view") && courseIds.length > 0
      ? await supabase.from("volunteer_students").select("id, name, course_id").in("course_id", courseIds)
      : { data: [] };

  // Financial strip. "Deposits held" now has a real field behind it: the
  // deposit is what lets a centre invite someone before the balance is settled
  // (migration 0105), and it lives on the applicant because it normally
  // arrives before any instalment schedule is agreed.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const paid = (payments ?? []).filter((p) => p.status === "paid");
  const collectedThisMonth = paid
    .filter((p) => p.paid_at && p.paid_at >= monthStart)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = (payments ?? [])
    .filter((p) => p.status === "pending" || p.status === "missed")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const refunded = (payments ?? []).filter((p) => p.status === "refunded").reduce((sum, p) => sum + Number(p.amount), 0);
  const depositsHeld = (applicants ?? [])
    .filter((a) => a.deposit_paid_at)
    .reduce((sum, a) => sum + Number(a.deposit_amount ?? 0), 0);
  const missed = (payments ?? []).filter((p) => p.status === "missed");
  const currency = (payments ?? [])[0]?.currency ?? "";

  const stageCounts = new Map<string, number>();
  for (const a of applicants ?? []) stageCounts.set(a.stage, (stageCounts.get(a.stage) ?? 0) + 1);

  const money = (n: number) => `${currency}${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
            {center?.name}
            {center?.center_number ? ` · Cambridge centre ${center.center_number}` : ""}
          </p>
          <h1 className="font-serif text-2xl text-ink">Centre overview</h1>
          <p className="text-xs text-muted">
            {ctx.roles.map((r) => CENTRE_ROLE_LABELS[r]).join(" · ")}
          </p>
        </div>
        {/* The read-only role's restriction is structural: this button is
            absent for a Centre manager, never rendered-then-blocked. */}
        {can(ctx.roles, "course.create") ? (
          <Link
            href="/dashboard/admin"
            className="rounded-[6px] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
          >
            New course
          </Link>
        ) : null}
      </div>

      {canView(ctx.roles, "payments.view") ? (
        <div className="sheet flex flex-wrap gap-8 border-t-[3px] border-t-primary">
          {[
            { k: "Collected this month", v: money(collectedThisMonth) },
            { k: "Deposits held", v: money(depositsHeld) },
            { k: "Outstanding balance", v: money(outstanding) },
            { k: "Refunds", v: money(refunded) },
          ].map((m) => (
            <div key={m.k} className="flex flex-col gap-0.5">
              <span className="font-serif text-2xl text-ink">{m.v}</span>
              <span className="text-[11px] tracking-[0.08em] text-muted uppercase">{m.k}</span>
            </div>
          ))}
          {(payments ?? []).length === 0 ? (
            <p className="self-center text-xs text-muted">No payments recorded yet.</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="sheet flex flex-col gap-3 border-t-[3px] border-t-ink-warm">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-warm uppercase">
            All courses · {(courses ?? []).length}
          </p>
          {(courses ?? []).length === 0 ? (
            <p className="py-2 text-sm text-muted">No courses in this centre yet.</p>
          ) : (
            (courses ?? []).map((c, i) => (
              <div key={c.id} className={`flex items-center justify-between gap-3 py-2 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-ink">{c.name}</span>
                  <span className="text-xs text-muted">
                    {c.start_date} → {c.end_date}
                    {c.delivery_mode ? ` · ${c.delivery_mode}` : ""}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-5">
          {canView(ctx.roles, "admissions.view") ? (
            <div className="sheet flex flex-col gap-2 border-t-[3px] border-t-primary">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
                Admissions pipeline · {(applicants ?? []).length}
              </p>
              {stageCounts.size === 0 ? (
                <p className="py-1 text-sm text-muted">Nobody in the pipeline yet.</p>
              ) : (
                [...stageCounts.entries()].map(([stage, count]) => (
                  <div key={stage} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted capitalize">{stage.replace(/_/g, " ")}</span>
                    <span className="text-ink tabular-nums">{count}</span>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {canView(ctx.roles, "payments.view") ? (
            <div className="sheet flex flex-col gap-2 border-t-[3px] border-t-gold">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
                Payments needing attention · {missed.length}
              </p>
              {missed.length === 0 ? (
                <p className="py-1 text-sm text-muted">Nothing missed.</p>
              ) : (
                missed.map((p, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-destructive">Missed instalment</span>
                    <span className="text-muted tabular-nums">
                      {money(Number(p.amount))} · due {p.due_date}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

      {canView(ctx.roles, "volunteers.view") ? (
        <div className="sheet flex flex-col gap-2 border-t-[3px] border-t-ink-warm">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-warm uppercase">
            Volunteer pool · {(volunteers ?? []).length}
          </p>
          {/* The spec asks for hours "accumulated across every course and level
              a volunteer has worked". volunteer_students has no cross-course
              identity at all -- no email, phone or external id, just a name and
              a course_id -- so a running total across courses cannot be
              computed without a volunteer-identity model. Same gap a previous
              session flagged on the trainer Volunteers screen. Counting the
              pool is honest; totalling hours by name would silently merge two
              different people. */}
          <p className="text-xs text-muted">
            Hours toward certificates are tracked per course. A total across courses needs a way to recognise the same
            volunteer on two courses, which the records don&apos;t currently carry.
          </p>
        </div>
      ) : null}
    </div>
  );
}
