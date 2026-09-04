import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId, getAssessorTermsStatus, isAssessorPreview } from "@/lib/auth/portfolio-access";
import { AssessorReadOnlyBanner } from "@/components/assessor-readonly-banner";
import { ASSIGNMENT_ORDER, ASSIGNMENT_INFO, ASSIGNMENT_WORD_COUNT } from "@/lib/assignment-info";
import type { TemplateSection } from "@/lib/assignment-templates/content";

const INK = "oklch(23.5% 0.017 65)";
const MUTED = "oklch(51% 0.017 70)";

// Ramy, 29 Aug 2026: "Assignment titles doesn't take you there." The
// pack's "Assignment titles" row used to link to the first candidate's
// resource hub, where the briefs sit inside a collapsed "Written
// Assignments" category most of the way down a long page -- so it opened
// somebody's resource hub, not the assignment titles.
//
// The Handbook lists assignment titles as a cohort document in its own
// right, alongside the timetable and the candidate descriptions, and they
// are identical for every candidate on the course. So this is a page about
// the course, not a detour through one candidate's portfolio.
//
// Read-only mirror of what a candidate sees, same "one source of truth
// read two ways" reasoning as assessor/marking-guidance/page.tsx. Sections
// are shown open rather than behind the trainee side's disclosure toggle:
// an assessor is here to read them, not to browse titles.
export default async function AssessorAssignmentTitlesPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(ASSESSOR_COOKIE)?.value) redirect("/login");
  const termsStatus = await getAssessorTermsStatus();
  if (!termsStatus) redirect("/login?error=assessor_link_invalid");
  if (!termsStatus.accepted && !(await isAssessorPreview())) redirect("/assessor/gate");
  const courseId = await getAssessorCourseId();
  if (!courseId) redirect("/login?error=assessor_link_invalid");

  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("center_id, name").eq("id", courseId).maybeSingle();
  if (!course) redirect("/login?error=assessor_link_invalid");

  const { data: templates } = await admin
    .from("assignment_templates")
    .select("id, assignment_type, sections, published_at")
    .eq("center_id", course.center_id)
    .not("published_at", "is", null);
  const templateByType = new Map((templates ?? []).map((t) => [t.assignment_type, t]));

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <AssessorReadOnlyBanner subject="the course" />
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "34px 24px 60px" }}>
        <div className="frame" style={{ padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>
            Assessor access — read-only · assignment titles
          </p>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 600, marginTop: 6, color: INK }}>
            The four written assignments
          </h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 8, maxWidth: 720, lineHeight: 1.6 }}>
            The same four titles for every candidate on {course.name}, each {ASSIGNMENT_WORD_COUNT}. Where this centre
            has published its own brief, its wording is shown beneath the title; the marks against these are in each
            candidate&apos;s portfolio.
          </p>

          {ASSIGNMENT_ORDER.map((type, i) => {
            const info = ASSIGNMENT_INFO[type];
            const template = templateByType.get(type);
            const sections = (template?.sections ?? []) as TemplateSection[];
            return (
              <div key={type} className="card" style={{ marginTop: i === 0 ? 26 : 14, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                      color: MUTED, flex: "none", fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {i + 1}
                  </span>
                  <h2 style={{ fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 600, color: INK }}>{info.title}</h2>
                </div>
                <p style={{ fontSize: 12.5, color: MUTED, marginTop: 6, lineHeight: 1.6 }}>{info.description}</p>

                {sections.length > 0 ? (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 11 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>
                      This centre&apos;s brief
                    </p>
                    {sections.map((s) => (
                      <div key={s.key}>
                        <p style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{s.title}</p>
                        <p style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.55, whiteSpace: "pre-line" }}>
                          {s.instruction}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11.5, color: "oklch(63% 0.012 82)", marginTop: 12 }}>
                    This centre has not published its own brief for this assignment.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
