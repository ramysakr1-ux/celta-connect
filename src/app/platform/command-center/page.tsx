import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

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
const INK = "oklch(0.235 0.017 65)";
const MUTED = "oklch(0.51 0.017 70)";
const BORDER = "oklch(0.895 0.012 82)";
const PAGE_BG = "oklch(0.935 0.012 82)";
const CARD = "oklch(0.992 0.005 90)";
const DARK = "oklch(0.14 0.012 60)";
const GOLD = "oklch(0.62 0.14 68)";
const TEAL = "oklch(0.375 0.058 195)";
const RED = "oklch(0.58 0.16 25)";

export default async function CommandCenterOverviewPage() {
  const profile = await requireRole("platform_owner");
  const admin = createAdminClient();

  const [{ data: centers }, { data: ownerRoles }, { data: tutorLinks }, { data: invites }] = await Promise.all([
    admin.from("centers").select("id, name, is_demo, created_at").order("name", { ascending: true }),
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
  const today = new Date().toISOString().slice(0, 10);
  const runningCourseByCenterId = new Map<string, boolean>();
  const courseLabelByCenterId = new Map<string, string>();
  for (const c of coursesList) {
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
        running: course.start_date <= today && course.end_date >= today,
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
        <div style={{ background: CARD, borderRadius: 10, boxShadow: "rgba(30,20,10,0.04) 0 1px 2px", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontFamily: "Newsreader, serif", fontSize: 17, fontWeight: 600, color: INK }}>Your courses</div>
          <div style={{ fontSize: 11.5, color: MUTED }}>Courses you&apos;re staffed on directly — opens the normal trainer view, same as any tutor.</div>
          {myCourses.map((c) => (
            <Link
              key={c.tutorLinkId}
              href={`/platform/command-center/enter-course/${c.courseId}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${BORDER}`, textDecoration: "none" }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                {c.centerName} · {c.label} — {(c.role ?? "role not set").replace(/_/g, " ")}
              </span>
              <span style={{ fontSize: 11, color: MUTED }}>{c.running ? "Running now" : "Not currently running"}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 22, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ background: CARD, borderRadius: 10, boxShadow: "rgba(30,20,10,0.04) 0 1px 2px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 6px" }}>
              <div style={{ fontFamily: "Newsreader, serif", fontSize: 17, fontWeight: 600, color: INK }}>Centres</div>
              <Link href="/platform" style={{ padding: "8px 16px", borderRadius: 20, background: GOLD, color: DARK, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                + Add a centre
              </Link>
            </div>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.2fr 0.8fr 1.2fr" }}>
                {["Centre", "Active course", "Trainees", ""].map((h) => (
                  <div key={h} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: MUTED, padding: "12px 20px", borderBottom: `1px solid ${BORDER}` }}>
                    {h}
                  </div>
                ))}
              </div>
              {centersList.map((c) => {
                const access = ownedCenterIds.has(c.id) ? "Owner" : invitedByCenterId.has(c.id) ? "Invited" : null;
                const running = runningCourseByCenterId.get(c.id) ?? false;
                return (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.2fr 0.8fr 1.2fr", alignItems: "center" }}>
                    <div style={{ padding: "15px 20px", borderBottom: `1px solid ${BORDER}`, fontSize: 13.5, color: INK, fontWeight: 600 }}>
                      {c.name}
                      {c.is_demo ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: MUTED }}>(demo)</span> : null}
                    </div>
                    <div style={{ padding: "15px 20px", borderBottom: `1px solid ${BORDER}` }}>
                      <span
                        style={{
                          display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 20,
                          background: running ? `color-mix(in oklab, ${TEAL} 12%, ${CARD})` : PAGE_BG,
                          color: running ? TEAL : MUTED,
                        }}
                      >
                        {running ? (courseLabelByCenterId.get(c.id) ?? "Active course now") : "No active course"}
                      </span>
                    </div>
                    <div style={{ padding: "15px 20px", borderBottom: `1px solid ${BORDER}`, fontSize: 13.5, color: "oklch(0.38 0.017 65)" }}>
                      {access && traineeCountByCenterId.has(c.id) ? traineeCountByCenterId.get(c.id) : "—"}
                    </div>
                    <div style={{ padding: "15px 20px", borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}>
                      {access ? (
                        <>
                          <span style={{ fontSize: 11, fontWeight: 700, color: access === "Owner" ? TEAL : MUTED, marginRight: 12 }}>{access}</span>
                          <Link href={access === "Owner" ? "/centre" : `/platform/command-center/enter/${c.id}`} style={{ fontSize: 11, fontWeight: 700, color: GOLD, textDecoration: "none" }}>
                            Open →
                          </Link>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: MUTED }}>No access</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "12px 20px", fontSize: 11, color: "oklch(0.58 0.017 70)", borderTop: `1px solid ${BORDER}` }}>
              Owner access is disclosed to the centre on their side. Centres you haven&apos;t been invited into show only what they&apos;ve chosen to make visible — no
              silent viewing.
            </div>
          </div>

          <div style={{ background: CARD, borderRadius: 10, borderLeft: `3px solid ${RED}`, boxShadow: "rgba(30,20,10,0.04) 0 1px 2px", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontFamily: "Newsreader, serif", fontSize: 17, fontWeight: 600, color: INK }}>Needs your attention</div>
            {needsAttentionCount === 0 ? (
              <p style={{ fontSize: 13, color: MUTED }}>Nothing needs you right now.</p>
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

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ background: CARD, borderRadius: 10, boxShadow: "rgba(30,20,10,0.04) 0 1px 2px", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "Newsreader, serif", fontSize: 17, fontWeight: 600, color: INK }}>Feedback &amp; support</div>
              {unreadSupportCount > 0 ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: `color-mix(in oklab, ${GOLD} 16%, ${CARD})`, color: "oklch(0.44 0.095 68)" }}>
                  {unreadSupportCount} unread
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 11.5, color: MUTED }}>
              Synced automatically from support@celtaconnect.com.{" "}
              {(supportMessages ?? []).length === 0 ? "No email-ingestion source is connected yet, so this stays empty until one is." : ""}
            </div>
            {(supportMessages ?? []).length === 0 ? (
              <p style={{ fontSize: 12.5, color: MUTED }}>Nothing yet.</p>
            ) : (
              (supportMessages ?? []).map((m) => (
                <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "12px 0", borderTop: `1px solid ${BORDER}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.read_at ? BORDER : GOLD, flex: "0 0 auto" }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>
                        {m.from_name ?? m.from_email}
                        {m.center_id ? ` — ${centerNameById.get(m.center_id) ?? ""}` : ""}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "oklch(0.58 0.017 70)" }}>{relativeTime(m.received_at)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, paddingLeft: 13 }}>{m.snippet}</div>
                </div>
              ))
            )}
          </div>

          <div style={{ background: CARD, borderRadius: 10, boxShadow: "rgba(30,20,10,0.04) 0 1px 2px", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontFamily: "Newsreader, serif", fontSize: 17, fontWeight: 600, color: INK }}>Activity, platform-wide</div>
            {activity.length === 0 ? (
              <p style={{ fontSize: 12.5, color: MUTED }}>Nothing yet.</p>
            ) : (
              activity.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <div style={{ fontSize: 11, color: "oklch(0.58 0.017 70)", width: 44, flex: "0 0 auto" }}>{relativeTime(item.at)}</div>
                  <div style={{ fontSize: 12.5, color: "oklch(0.38 0.017 65)" }}>{item.label}</div>
                </div>
              ))
            )}
          </div>

          <Link
            href="/platform/accounts"
            style={{ textAlign: "center", padding: "12px 16px", borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: 12.5, fontWeight: 600, color: TEAL, textDecoration: "none" }}
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
// single-page build used before this section had its own left-border-red
// card shell.
function AttentionRow({ dot, title, detail }: { dot: string; title: string; detail: string }) {
  return (
    <div
      style={{
        display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 7,
        background: `color-mix(in oklab, ${dot} 8%, ${CARD})`,
        border: `1px solid color-mix(in oklab, ${dot} 24%, transparent)`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, marginTop: 6, flex: "0 0 auto" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{title}</div>
        <div style={{ fontSize: 12, color: MUTED }}>{detail}</div>
      </div>
    </div>
  );
}
