import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

// for-claude-code-command-center.md, built 2026-08-25, restructured to
// command-center-full-spec.md's sidebar-nav shell the same day. Ramy's own
// words on the access model, verbatim from that first session: "I do not
// want to spy on them. I don't wanna have a backdoor where I go and see
// what they're doing... they can always send me an invite, and then I can
// go, and it will be logged." Three real doors into a centre's own data,
// nothing else:
//
// 1. Owner -- centre_roles already has this (role = 'centre_owner'). A
//    centre Ramy genuinely runs himself, not just software he sells.
// 2. Course role -- course_tutors already has this. "I should have access
//    into the course that I'm on, not just the centre that I own" -- an
//    MCT/ACT assignment on one course, independent of who owns the centre.
// 3. Invited -- platform_owner_invites: a centre's own centre_roles holder
//    explicitly invites Ramy in. Standing, revocable, logged.
//
// No fourth "platform owner override" -- explicitly rejected in the same
// session. A centre with none of the three shows only its name and whether
// a course is currently running -- nothing else, no drill-through.
//
// "Your courses" isn't in command-center-full-spec.md's Overview layout at
// all (that spec only lists Centres + Needs your attention + Feedback &
// support + Activity) -- kept anyway, at the top of the left column, since
// it's real working functionality from door #2 above and dropping it would
// be a regression the new spec never asked for, not an intentional cut.
// Flagged back to Ramy rather than silently kept or silently dropped.
//
// Card/panel styling migrated onto the shared .card/.admin-hover design
// system 27 Aug 2026 (was hand-built inline styles copied straight from
// command-center-visual-reference.html, never wired to the shared tokens).
// Dynamic per-row dot colors (AttentionRow, below) stay inline -- each row
// picks one of several colors at runtime, which a static Tailwind class
// name can't express -- but now reference the real --color-* custom
// properties instead of duplicating their oklch literals.
const RED = "var(--color-destructive)";
const GOLD = "var(--color-gold)";
const MUTED = "var(--color-muted)";

export default async function CommandCenterOverviewPage() {
  const profile = await requireRole("platform_owner");
  const admin = createAdminClient();

  const [{ data: centers }, { data: ownerRoles }, { data: tutorLinks }, { data: invites }] = await Promise.all([
    admin.from("centers").select("id, name, is_demo, created_at, time_zone").order("name", { ascending: true }),
    admin.from("centre_roles").select("center_id").eq("profile_id", profile.id).eq("role", "centre_owner").is("revoked_at", null),
    admin
      .from("course_tutors")
      .select("id, course_id, tutor_role, courses(id, name, course_code, center_id, start_date, end_date)")
      .eq("profile_id", profile.id)
      .is("left_at", null),
    admin.from("platform_owner_invites").select("*").is("revoked_at", null),
  ]);

  const centersList = centers ?? [];
  const ownedCenterIds = new Set((ownerRoles ?? []).map((r) => r.center_id));
  const invitedByCenterId = new Map((invites ?? []).map((i) => [i.center_id, i]));
  const accessibleCenterIds = new Set([...ownedCenterIds, ...invitedByCenterId.keys()]);

  const [{ data: courses }, { data: trainees }] = await Promise.all([
    admin.from("courses").select("id, name, center_id, start_date, end_date"),
    accessibleCenterIds.size > 0
      ? admin.from("profiles").select("id, center_id").eq("role", "trainee").in("center_id", [...accessibleCenterIds])
      : Promise.resolve({ data: [] }),
  ]);
  const coursesList = courses ?? [];
  // Ramy, 28 Aug 2026: "the timezone changed" -- this used to be
  // new Date().toISOString().slice(0,10), UTC's own date, which disagrees
  // with a viewer's actual calendar date for several hours every day
  // (right now, UTC is still Aug 27 while Istanbul -- and Singapore -- are
  // already Aug 28). Not something the region change caused (toISOString()
  // is UTC no matter where the function runs); it just happened to surface
  // now. Fixed the way every other course-running check in the app already
  // does it: each course's own centre's time_zone, not the server's.
  const now = new Date();
  const todayByCenterId = new Map(centersList.map((c) => [c.id, toLocalIso(now, c.time_zone ?? DEFAULT_TIMEZONE)]));
  const runningCourseByCenterId = new Map<string, boolean>();
  const courseLabelByCenterId = new Map<string, string>();
  for (const c of coursesList) {
    const today = todayByCenterId.get(c.center_id) ?? toLocalIso(now, DEFAULT_TIMEZONE);
    if (c.start_date <= today && c.end_date >= today) {
      runningCourseByCenterId.set(c.center_id, true);
      courseLabelByCenterId.set(c.center_id, c.name);
    }
  }
  const traineeCountByCenterId = new Map<string, number>();
  for (const t of trainees ?? []) {
    traineeCountByCenterId.set(t.center_id, (traineeCountByCenterId.get(t.center_id) ?? 0) + 1);
  }

  const centerNameById = new Map(centersList.map((c) => [c.id, c.name]));
  const myCourses = (tutorLinks ?? [])
    .map((t) => {
      const course = t.courses as unknown as { id: string; name: string; course_code: string | null; center_id: string; start_date: string; end_date: string } | null;
      if (!course) return null;
      return {
        tutorLinkId: t.id,
        courseId: course.id,
        label: course.course_code || course.name,
        centerName: centerNameById.get(course.center_id) ?? "Unknown centre",
        role: t.tutor_role,
        running:
          course.start_date <= (todayByCenterId.get(course.center_id) ?? toLocalIso(now, DEFAULT_TIMEZONE)) &&
          course.end_date >= (todayByCenterId.get(course.center_id) ?? toLocalIso(now, DEFAULT_TIMEZONE)),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const [{ data: malpracticeCases }, { data: outstandingInvoices }, { data: subs }, { data: pendingCentreInvites }] = await Promise.all([
    accessibleCenterIds.size > 0
      ? admin
          .from("malpractice_cases")
          .select("id, course_id, trainee_id, flagged_for_referral, outcome, decided_at, courses(center_id)")
          .eq("status", "decided")
          .eq("flagged_for_referral", true)
      : Promise.resolve({ data: [] }),
    admin.from("centre_invoices").select("id, center_id, amount, currency, due_date, status").eq("status", "outstanding"),
    admin.from("centre_subscriptions").select("center_id, renewal_date, status").eq("status", "active"),
    admin.from("centre_admin_invites").select("id, center_id, created_at").is("used_at", null).is("revoked_at", null),
  ]);

  const OVERDUE_DAYS = 7;
  const overdueCutoff = new Date();
  overdueCutoff.setDate(overdueCutoff.getDate() - OVERDUE_DAYS);
  const overdueInvoices = (outstandingInvoices ?? []).filter((i) => i.due_date && new Date(i.due_date) < overdueCutoff);

  const ACTIVATION_DAYS = 7;
  const activationCutoff = new Date();
  activationCutoff.setDate(activationCutoff.getDate() - ACTIVATION_DAYS);
  const staleOnboarding = (pendingCentreInvites ?? []).filter((i) => new Date(i.created_at) < activationCutoff);

  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const renewalsDue = (subs ?? []).filter((s) => s.renewal_date && new Date(s.renewal_date) <= in30Days);

  const flaggedCases = (malpracticeCases ?? []).filter((c) => {
    const course = c.courses as unknown as { center_id: string } | null;
    return course && accessibleCenterIds.has(course.center_id);
  });

  const needsAttentionCount = flaggedCases.length + overdueInvoices.length + staleOnboarding.length + renewalsDue.length;

  const { data: supportMessages } = await admin.from("support_messages").select("*").order("received_at", { ascending: false }).limit(8);
  const unreadSupportCount = (supportMessages ?? []).filter((m) => !m.read_at).length;

  type ActivityItem = { at: string; label: string };
  const { data: invoicesForActivity } = await admin.from("centre_invoices").select("center_id, amount, currency, status, paid_at, created_at");
  const activity: ActivityItem[] = [
    ...flaggedCases.map((c) => ({
      at: c.decided_at ?? "",
      label: `Malpractice case referred to centre procedure — ${centerNameById.get((c.courses as unknown as { center_id: string })?.center_id) ?? "a centre"}`,
    })),
    ...(invoicesForActivity ?? [])
      .filter((i) => accessibleCenterIds.has(i.center_id) || i.status === "paid")
      .map((i) => ({
        at: i.paid_at ?? i.created_at,
        label: `${centerNameById.get(i.center_id) ?? "A centre"}'s ${i.currency}${i.amount.toLocaleString()} invoice ${i.status === "paid" ? "paid" : i.status === "void" ? "voided" : "recorded"}`,
      })),
  ]
    .filter((a) => a.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);

  function relativeTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "Now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

  return (
    <>
      {myCourses.length > 0 ? (
        <div className="card flex flex-col gap-3.5 p-5">
          <h2 className="font-serif text-lg text-ink">Your courses</h2>
          <p className="text-[11.5px] text-muted">Courses you&apos;re staffed on directly — opens the normal trainer view, same as any tutor.</p>
          {myCourses.map((c) => (
            <Link
              key={c.tutorLinkId}
              href={`/platform/command-center/enter-course/${c.courseId}`}
              className="admin-hover flex items-center justify-between border-t border-border-faint py-3"
            >
              <span className="text-sm font-semibold text-ink">
                {c.centerName} · {c.label} — {(c.role ?? "role not set").replace(/_/g, " ")}
              </span>
              <span className="text-[11px] text-muted">{c.running ? "Running now" : "Not currently running"}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="flex flex-col gap-[22px]">
          <div className="card !p-0">
            <div className="flex items-center justify-between px-5 pt-[18px] pb-1.5">
              <h2 className="font-serif text-lg text-ink">Centres</h2>
              <Link href="/platform" className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90">
                + Add a centre
              </Link>
            </div>
            <div>
              <div className="grid grid-cols-[1.4fr_1.2fr_0.8fr_1.2fr] border-b border-border">
                {["Centre", "Active course", "Trainees", ""].map((h) => (
                  <div key={h} className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-muted">
                    {h}
                  </div>
                ))}
              </div>
              {/* The rule belongs to the ROW, not to the four cells. Each cell
                  used to carry its own border-b while the row was
                  items-center, so a cell only as tall as its text drew its
                  border higher than the cell holding a pill: one rule
                  rendering as four staggered segments. Ramy, 3 Sep 2026: "the
                  lines are broken... I just don't like looking at the centre
                  cards." last:border-b-0 because the footer below draws its
                  own border-t, and the two together doubled the rule at the
                  bottom of the table. */}
              {centersList.map((c) => {
                const access = ownedCenterIds.has(c.id) ? "Owner" : invitedByCenterId.has(c.id) ? "Invited" : null;
                const running = runningCourseByCenterId.get(c.id) ?? false;
                return (
                  <div
                    key={c.id}
                    className="admin-hover grid grid-cols-[1.4fr_1.2fr_0.8fr_1.2fr] items-center border-b border-border last:border-b-0"
                  >
                    <div className="px-5 py-[15px] text-[13.5px] font-semibold text-ink">
                      {c.name}
                      {c.is_demo ? <span className="ml-2 text-[11px] font-normal text-muted">(demo)</span> : null}
                    </div>
                    <div className="px-5 py-[15px]">
                      <span
                        className={`inline-block rounded-full px-[11px] py-1 text-[11.5px] font-bold ${
                          running ? "bg-status-on-track-bg text-status-on-track-text" : "bg-surface-muted text-muted"
                        }`}
                      >
                        {running ? (courseLabelByCenterId.get(c.id) ?? "Active course now") : "No active course"}
                      </span>
                    </div>
                    <div className="px-5 py-[15px] text-[13.5px] text-ink">
                      {access && traineeCountByCenterId.has(c.id) ? traineeCountByCenterId.get(c.id) : "—"}
                    </div>
                    <div className="px-5 py-[15px] text-right">
                      {access ? (
                        <>
                          <span className={`mr-3 text-[11px] font-bold ${access === "Owner" ? "text-primary" : "text-muted"}`}>{access}</span>
                          <Link href={access === "Owner" ? "/centre" : `/platform/command-center/enter/${c.id}`} className="text-[11px] font-bold text-primary">
                            Open →
                          </Link>
                        </>
                      ) : (
                        <span className="text-[11px] text-muted">No access</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border px-5 py-3 text-[11px] text-muted">
              Owner access is disclosed to the centre on their side. Centres you haven&apos;t been invited into show only what they&apos;ve chosen to make
              visible — no silent viewing.
            </div>
          </div>

          <div className="card card-red flex flex-col gap-3.5 p-5">
            <h2 className="font-serif text-lg text-ink">Needs your attention</h2>
            {needsAttentionCount === 0 ? (
              <p className="text-sm text-muted">Nothing needs you right now.</p>
            ) : (
              <>
                {flaggedCases.map((c) => (
                  <AttentionRow
                    key={c.id}
                    dot={RED}
                    title="Malpractice case pending your review"
                    detail={`${centerNameById.get((c.courses as unknown as { center_id: string })?.center_id) ?? "A centre"} — ${c.outcome}. Referred to centre procedure.`}
                  />
                ))}
                {overdueInvoices.map((i) => (
                  <AttentionRow
                    key={i.id}
                    dot={GOLD}
                    title={`Overdue payment, ${Math.floor((Date.now() - new Date(i.due_date!).getTime()) / 86400000)} days`}
                    detail={`${centerNameById.get(i.center_id) ?? "A centre"} — ${i.currency}${i.amount.toLocaleString()} outstanding, past the ${OVERDUE_DAYS}-day reminder.`}
                  />
                ))}
                {staleOnboarding.map((i) => (
                  <AttentionRow
                    key={i.id}
                    dot={MUTED}
                    title={`Centre invited ${Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86400000)} days ago, not yet active`}
                    detail={`${centerNameById.get(i.center_id) ?? "A centre"} hasn't opened its onboarding link.`}
                  />
                ))}
                {renewalsDue.map((s, i) => (
                  <AttentionRow key={i} dot={GOLD} title="Renewal due" detail={`${centerNameById.get(s.center_id) ?? "A centre"} — renews ${s.renewal_date}.`} />
                ))}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-[22px]">
          <div className="card card-garnet flex flex-col gap-3.5 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg text-ink">Feedback &amp; support</h2>
              {unreadSupportCount > 0 ? <span className="pill pill-warning">{unreadSupportCount} unread</span> : null}
            </div>
            <div className="text-[11.5px] text-muted">
              Synced automatically from support@celtaconnect.com.{" "}
              {(supportMessages ?? []).length === 0 ? "No email-ingestion source is connected yet, so this stays empty until one is." : ""}
            </div>
            {(supportMessages ?? []).length === 0 ? (
              <p className="text-[12.5px] text-muted">Nothing yet.</p>
            ) : (
              (supportMessages ?? []).map((m) => (
                <div key={m.id} className="admin-hover flex flex-col gap-0.5 border-t border-border-faint py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[7px]">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.read_at ? "bg-border" : "bg-gold"}`} />
                      <span className="text-[12.5px] font-bold text-ink">
                        {m.from_name ?? m.from_email}
                        {m.center_id ? ` — ${centerNameById.get(m.center_id) ?? ""}` : ""}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted">{relativeTime(m.received_at)}</span>
                  </div>
                  <div className="pl-[13px] text-xs text-muted">{m.snippet}</div>
                </div>
              ))
            )}
          </div>

          <div className="card flex flex-col gap-3.5 p-5">
            <h2 className="font-serif text-lg text-ink">Activity, platform-wide</h2>
            {activity.length === 0 ? (
              <p className="text-[12.5px] text-muted">Nothing yet.</p>
            ) : (
              activity.map((item, i) => (
                <div key={i} className="admin-hover flex items-baseline gap-2.5">
                  <div className="w-11 shrink-0 text-[11px] text-muted">{relativeTime(item.at)}</div>
                  <div className="text-[12.5px] text-ink">{item.label}</div>
                </div>
              ))
            )}
          </div>

          <Link
            href="/platform/accounts"
            className="admin-hover-fill rounded-[6px] border border-border px-4 py-3 text-center text-[12.5px] font-semibold text-primary"
          >
            Accounts, subscriptions &amp; invoices →
          </Link>
        </div>
      </div>
    </>
  );
}

// command-center-full-spec.md: "colored dot + bg + border (severity-coded:
// red for malpractice, amber/gold for payment, neutral gray for stale
// invite)" -- a light, tinted row, not the dark-card treatment the old
// single-page build used before this section had its own top-rule red card
// shell (.card-red, above). The tint color is picked per-item at runtime
// (red/gold/muted), which a static Tailwind class can't express, so it
// stays inline -- but against the real --color-destructive/--color-gold/
// --color-muted tokens now, not duplicated oklch literals.
function AttentionRow({ dot, title, detail }: { dot: string; title: string; detail: string }) {
  return (
    <div
      className="admin-hover flex items-start gap-3 rounded-[6px] px-3.5 py-3"
      style={{
        background: `color-mix(in oklab, ${dot} 8%, var(--color-card))`,
        border: `1px solid color-mix(in oklab, ${dot} 24%, transparent)`,
      }}
    >
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
      <div className="flex flex-col gap-0.5">
        <div className="text-sm font-bold text-ink">{title}</div>
        <div className="text-xs text-muted">{detail}</div>
      </div>
    </div>
  );
}
