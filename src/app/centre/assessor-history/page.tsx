import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { canView } from "@/lib/auth/centre-permissions";
import { computeAssessorCentreHistory, type Severity } from "@/lib/assessor-course-history";
import { formatCalendarDate } from "@/lib/format-date";

// Dedicated screen reached from the "Assessor history" card on Centre
// Admin overview (centre/page.tsx) -- same pattern as /centre/volunteers:
// the card stays a lightweight summary, this page owns the full,
// unbounded, per-assessor detail. Rebuilt against the real design handoff
// (Assessor History.dc.html / assessor-history-full-spec.md, 25 Aug 2026)
// -- the earlier text-only-spec version was missing the consecutive-vs-
// concurrent distinction, the severity colours, the flag explanation, and
// the per-course overlap/status columns entirely.
const SEVERITY_COLOR: Record<Severity, string> = {
  fine: "var(--color-ink)",
  "at-limit": "var(--color-status-warning-text)",
  over: "var(--color-status-at-risk-text)",
};

export default async function AssessorHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  if (ctx.roles.length === 0) redirect("/dashboard");
  if (!canView(ctx.roles, "courseAdmin.view", ctx.overrides)) redirect("/centre");

  const { branch } = await searchParams;
  const mine = ctx.availableCenterIds;
  const scope = branch && mine.includes(branch) ? [branch] : mine;

  const admin = createAdminClient();
  const [{ data: courses }, { data: centers }] = await Promise.all([
    admin.from("courses").select("id, name, course_code, start_date, end_date").in("center_id", scope),
    admin.from("centers").select("id, name").in("id", scope),
  ]);
  const centreNameLabel = (centers ?? []).map((c) => c.name).join(", ") || "This centre";
  const courseIds = (courses ?? []).map((c) => c.id);

  const { data: assessorLinkRows } =
    courseIds.length > 0
      ? await admin.from("course_tutors").select("course_id, profile_id").eq("tutor_role", "external_assessor").in("course_id", courseIds)
      : { data: [] };
  const assessorProfileIds = [...new Set((assessorLinkRows ?? []).map((r) => r.profile_id))];
  const { data: assessorProfiles } =
    assessorProfileIds.length > 0 ? await admin.from("profiles").select("id, full_name, email").in("id", assessorProfileIds) : { data: [] };
  const assessorNameById = new Map((assessorProfiles ?? []).map((p) => [p.id, p.full_name]));
  const assessorEmailById = new Map((assessorProfiles ?? []).map((p) => [p.id, p.email]));

  const history = computeAssessorCentreHistory(
    (courses ?? []).map((c) => ({ id: c.id, label: c.course_code ?? c.name, start_date: c.start_date, end_date: c.end_date })),
    (assessorLinkRows ?? []).map((r) => ({
      profileId: r.profile_id,
      name: assessorNameById.get(r.profile_id) ?? "Unknown",
      courseId: r.course_id,
    }))
  );

  const dateRange = (a: string, b: string) => {
    const fmt = (iso: string) => formatCalendarDate(iso, { day: "numeric", month: "short", year: "numeric" });
    return `${fmt(a)} – ${fmt(b)}`;
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Remainder pass B3: a BackLink sat at the RIGHT end of this row, which
          is where nothing else in the app puts the way back. This page is
          inside Centre Management, so the dropped room pill is already the way
          out; a second one said it twice, in the wrong corner. */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex max-w-[820px] flex-col gap-[13px]">
          <p className="text-label font-bold tracking-[0.14em] text-muted uppercase">{centreNameLabel} &middot; compliance &middot; visible only, not enforced</p>
          <h1 className="font-serif text-display leading-[1.14] font-semibold text-ink">Assessor history</h1>
          <p className="text-body leading-[1.6] text-muted text-pretty">
            Handbook 13.3: the same assessor must not be used for more than two consecutive courses. Handbook 13.8: an assessor must not assess
            more than two concurrent courses at a centre. A centre does not choose its assessor and repeat visits are common, so this is not
            enforced — it is kept visible so a centre administrator can see the pattern.
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="card px-5 py-4">
          <p className="text-body text-muted">No assessor has been linked to a course at this centre yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {history.map((a) => (
            <div key={a.profileId} className="hover-ring flex flex-col gap-4 rounded-[8px] border border-border bg-card p-[22px_24px]">
              <div className="flex flex-wrap items-baseline justify-between gap-3.5">
                <div className="flex flex-col gap-[3px]">
                  <p className="font-serif text-h3 font-semibold text-ink">{a.name}</p>
                  <p className="text-label text-muted">
                    {a.courses.length} {a.courses.length === 1 ? "course" : "courses"} assessed at this centre
                    {assessorEmailById.get(a.profileId) ? ` · ${assessorEmailById.get(a.profileId)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-5">
                  <div className="flex flex-col items-end gap-0.5">
                    <p className="font-serif text-h2 font-semibold" style={{ color: SEVERITY_COLOR[a.currentStreakSeverity] }}>
                      {a.currentStreak}
                    </p>
                    <p className="text-micro font-bold tracking-[0.08em] text-muted uppercase">Consecutive streak</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <p className="font-serif text-h2 font-semibold" style={{ color: SEVERITY_COLOR[a.peakConcurrentSeverity] }}>
                      {a.peakConcurrent}
                    </p>
                    <p className="text-micro font-bold tracking-[0.08em] text-muted uppercase">Peak concurrent</p>
                  </div>
                </div>
              </div>

              {a.flag ? (
                <div
                  className="flex items-start gap-2.5 rounded-[6px] px-3.5 py-2.5"
                  style={{
                    background: "color-mix(in oklab, var(--color-status-warning-text) 10%, var(--color-card))",
                    border: "1px solid color-mix(in oklab, var(--color-status-warning-text) 30%, transparent)",
                  }}
                >
                  <span className="mt-1.5 size-[5px] shrink-0 rounded-full" style={{ background: "var(--color-status-warning-text)" }} />
                  <p className="text-label leading-[1.5] text-ink">{a.flagText}</p>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-[6px] border border-border">
                <div className="grid grid-cols-[96px_1fr_minmax(0,160px)_96px] gap-2 bg-[color-mix(in_oklab,var(--color-card-inset)_60%,var(--color-card))] px-3 py-2.5 text-micro font-bold tracking-[0.08em] text-muted uppercase">
                  <span>Dates</span>
                  <span>Course</span>
                  <span>Overlap</span>
                  <span>Status</span>
                </div>
                {a.courses.map((c, i) => (
                  <div
                    key={c.id}
                    className={`hover-ring grid grid-cols-[96px_1fr_minmax(0,160px)_96px] items-center gap-2 px-3 py-2.5 text-meta text-ink ${i > 0 ? "border-t border-border-faint" : ""}`}
                  >
                    <span className="text-label text-muted">{dateRange(c.start_date, c.end_date)}</span>
                    <span className="font-semibold">{c.label}</span>
                    <span className="text-label text-muted">{c.overlap}</span>
                    <span>
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-[3px] text-label font-semibold"
                        style={
                          c.status === "Active"
                            ? { background: "var(--color-status-on-track-bg)", color: "var(--color-status-on-track-text)" }
                            : { background: "var(--color-card-inset)", color: "var(--color-muted)" }
                        }
                      >
                        {c.status}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
