import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { canView } from "@/lib/auth/centre-permissions";
import { computeAssessorCentreHistory } from "@/lib/assessor-course-history";

// Dedicated screen reached from the "Assessor history" card on Centre
// Admin overview (centre/page.tsx) -- same pattern as /centre/volunteers:
// the card stays a lightweight summary, this page owns the full,
// unbounded, per-assessor detail. Handbook 12.3 / for-claude-code-
// concurrent-course-checks.md: visible only, nothing here blocks anything.
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
  if (!canView(ctx.roles, "courseAdmin.view")) redirect("/centre");

  const { branch } = await searchParams;
  const mine = ctx.availableCenterIds;
  const scope = branch && mine.includes(branch) ? [branch] : mine;

  const admin = createAdminClient();
  const { data: courses } = await admin
    .from("courses")
    .select("id, name, course_code, start_date, end_date")
    .in("center_id", scope);
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
    const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return `${fmt(a)} – ${fmt(b)}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Centre overview &middot; assessor history</p>
          <h1 className="font-serif text-2xl text-ink">Assessor history</h1>
          <p className="max-w-2xl text-sm text-muted">
            Every course an external assessor has been linked to at this centre. Handbook 12.3 asks that an assessor not
            assess more than two concurrent courses at a centre -- shown here, not enforced, since a centre doesn&apos;t
            choose its own assessor.
          </p>
        </div>
        <Link href="/centre" className="text-sm font-semibold text-muted hover:text-ink">
          ← Overview
        </Link>
      </div>

      {history.length === 0 ? (
        <div className="card px-5 py-4">
          <p className="text-sm text-muted">No assessor has been linked to a course at this centre yet.</p>
        </div>
      ) : (
        history.map((a, i) => (
          <div key={a.profileId} className={`card ${a.peakConcurrent > 2 ? "card-amber" : i % 2 === 1 ? "card-gold" : ""}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-serif text-base text-ink">{a.name}</h2>
                {assessorEmailById.get(a.profileId) ? (
                  <p className="text-xs text-muted">{assessorEmailById.get(a.profileId)}</p>
                ) : null}
              </div>
              <div className="flex gap-4 text-xs">
                <span className={a.peakConcurrent > 2 ? "font-semibold text-status-warning-text" : "text-muted"}>
                  {a.peakConcurrent} concurrent at peak
                  {a.peakConcurrent > 2 ? " (over the guideline)" : ""}
                </span>
                <span className="text-muted">{a.currentStreak} course{a.currentStreak === 1 ? "" : "s"} in a row currently</span>
              </div>
            </div>
            {a.courses.map((c, i) => (
              <div key={c.id} className={`flex items-center justify-between px-5 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                <span className="text-sm text-ink">{c.label}</span>
                <span className="text-xs text-muted">{dateRange(c.start_date, c.end_date)}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
