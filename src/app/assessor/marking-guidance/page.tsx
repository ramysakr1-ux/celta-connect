import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId, getAssessorTermsStatus } from "@/lib/auth/portfolio-access";
import { getMarkingGuidance } from "@/lib/marking-guidance";
import { ASSIGNMENT_ORDER, ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { getAllAssignmentCriteria } from "@/lib/assignment-criteria";
import type { AssignmentTypeValue } from "@/lib/assignment-templates/content";

const TAB_ORDER: AssignmentTypeValue[] = [...ASSIGNMENT_ORDER, "Plagiarism Reflection"];

// Read-only mirror of the trainer-facing page (marking-guidance/page.tsx) --
// same "one source of truth read two ways" reasoning as the rest of the
// assessor surfaces (see assessor-pack-contents.ts). The assessor's own
// route into this: the "Marking guidance" line on the centre-documents
// panel (assessor/page.tsx), per design's "sits in the visit pack rather
// than being asked for" -- 8.2 evidence, not a nav item.
export default async function AssessorMarkingGuidancePage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(ASSESSOR_COOKIE)?.value) redirect("/login");
  const termsStatus = await getAssessorTermsStatus();
  if (!termsStatus) redirect("/login?error=assessor_link_invalid");
  if (!termsStatus.accepted) redirect("/assessor/gate");
  const courseId = await getAssessorCourseId();
  if (!courseId) redirect("/login?error=assessor_link_invalid");

  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("center_id").eq("id", courseId).maybeSingle();
  if (!course) redirect("/login?error=assessor_link_invalid");

  const guidanceMap = await getMarkingGuidance(admin, course.center_id);
  const allCriteria = await getAllAssignmentCriteria(admin, course.center_id);
  const updatedByIds = [...new Set([...guidanceMap.values()].flatMap((byKey) => [...byKey.values()].map((r) => r.updated_by).filter((id): id is string => Boolean(id))))];
  const { data: updaters } = updatedByIds.length > 0 ? await admin.from("profiles").select("id, full_name").in("id", updatedByIds) : { data: [] };
  const updaterNameById = new Map((updaters ?? []).map((u) => [u.id, u.full_name]));

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "34px 24px 60px", fontFamily: "Helvetica, Arial, sans-serif", color: "#241d16" }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d655c" }}>
        Assessor access — read-only · marking guidance
      </p>
      <h1 style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 600, marginTop: 6 }}>
        This centre&apos;s standardisation evidence
      </h1>
      <p style={{ fontSize: 13, color: "#6d655c", marginTop: 8, maxWidth: 720, lineHeight: 1.6 }}>
        Written by this centre&apos;s own tutors at standardisation meetings, not by Cambridge or by Connect. Kept
        beside each criterion while marking.
      </p>

      {TAB_ORDER.map((type) => {
        const criteria = allCriteria[type];
        const byKey = guidanceMap.get(type);
        return (
          <div key={type} style={{ marginTop: 32 }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 600 }}>{ASSIGNMENT_INFO[type].title}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
              {criteria.map((c) => {
                const row = byKey?.get(c.key);
                const hasContent = row && (row.met_text || row.grey_text || row.not_text || row.agreed_text);
                return (
                  <div
                    key={c.key}
                    style={{
                      background: "#fdfcfa",
                      border: "1px solid #e0dcd4",
                      borderLeft: "3px solid #a89e8f",
                      borderRadius: 6,
                      padding: "16px 18px",
                    }}
                  >
                    <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: hasContent ? 12 : 0 }}>{c.text}</p>
                    {hasContent ? (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                          <GuidanceColumn label="Enough to meet it" text={row?.met_text} />
                          <GuidanceColumn label="Centre judgement" text={row?.grey_text} />
                          <GuidanceColumn label="Not yet" text={row?.not_text} />
                        </div>
                        {row?.agreed_text ? (
                          <div style={{ marginTop: 12, background: "#f4f1eb", borderRadius: 5, padding: "10px 13px" }}>
                            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d655c" }}>
                              Agreed
                            </p>
                            <p style={{ fontSize: 12, color: "#6d655c", marginTop: 3, lineHeight: 1.5 }}>{row.agreed_text}</p>
                          </div>
                        ) : null}
                        {row?.updated_at ? (
                          <p style={{ fontSize: 10.5, color: "#a39b8f", marginTop: 8 }}>
                            {row.updated_by && updaterNameById.get(row.updated_by) ? `${updaterNameById.get(row.updated_by)} · ` : ""}
                            {new Date(row.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p style={{ fontSize: 12, color: "#a39b8f" }}>Not written yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GuidanceColumn({ label, text }: { label: string; text: string | null | undefined }) {
  if (!text) return <div />;
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d655c" }}>{label}</p>
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
        {text.split("\n").filter(Boolean).map((line, i) => (
          <p key={i} style={{ fontSize: 11.5, color: "#38352f", lineHeight: 1.5 }}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
