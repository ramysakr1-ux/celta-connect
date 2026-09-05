import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId, isAssessorTourMode } from "@/lib/auth/portfolio-access";
import { trainerInTrainingAccess } from "@/lib/tit-access";
import { TitWorkspace } from "@/app/trainer/(hub)/trainer-in-training/workspace";
import { AccessPanel, type AccessGrantView } from "@/app/trainer/(hub)/trainer-in-training/access-panel";
import { PageHead } from "@/app/trainer/(hub)/page-head";

// specs/for-claude-code-trainer-in-training.md: the whole TinT portfolio
// workspace. Private to the people the record concerns -- "the TinT has no
// official capacity with candidates," and that principle extends to this
// screen itself. Since migration 0267 that circle is: the TinT, their
// supervisor, the MCT, anyone the MCT has granted (the grant list is on
// the page), and a touring assessor, read-only. RLS (tit_can_access())
// enforces the same circle at the data layer.
export default async function TrainerInTrainingPage() {
  const session = await getCurrentProfile();
  const trainer =
    session?.profile?.role === "trainer" || session?.profile?.role === "admin" || session?.profile?.role === "platform_owner"
      ? session.profile
      : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");
  const tour = assessorCourseId && !trainer ? await isAssessorTourMode() : false;
  if (assessorCourseId && !trainer && !tour) redirect("/assessor");

  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }

  const admin = createAdminClient();
  let isMct = trainer?.role === "admin";
  if (trainer && !isMct) {
    const { data: link } = await admin
      .from("course_tutors")
      .select("tutor_role")
      .eq("course_id", courseId)
      .eq("profile_id", trainer.id)
      .is("left_at", null)
      .maybeSingle();
    isMct = link?.tutor_role === "main_course_tutor";
  }

  const access = await trainerInTrainingAccess({
    courseId,
    profile: trainer ? { id: trainer.id, role: trainer.role, isMct } : null,
    assessorTour: tour,
  });

  const heading = (
    <PageHead
      eyebrow="Trainer-in-Training · private"
      title="Trainer-in-Training"
      lede="Everything here stays between the trainer-in-training, their supervisor, the main course tutor and anyone they let in -- nothing on this page ever reaches a candidate."
    />
  );

  if (access.all.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <div className="sheet text-sm text-muted">
          No trainer-in-training on this course. Set someone as one, with a verification date and a supervisor, on the Tutors panel in Centre
          settings.
        </div>
      </div>
    );
  }
  if (access.visible.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <div className="sheet text-sm text-muted">
          This course has a trainer-in-training, but their record is private to them, their supervisor and the main course tutor. The MCT can grant
          you access.
        </div>
      </div>
    );
  }

  // Names and the grant list, in one pass. Admin client: an assessor session
  // has no RLS identity, and profile names are not sensitive to anyone who
  // has got this far.
  const [{ data: tutorsOnCourse }, { data: grants }, { data: records }] = await Promise.all([
    admin.from("course_tutors").select("profile_id, tutor_role").eq("course_id", courseId).is("left_at", null),
    admin.from("tit_access_grants").select("*").in("course_tutors_id", access.visible.map((t) => t.id)).order("granted_at", { ascending: true }),
    trainer
      ? Promise.resolve({ data: [] as { course_tutors_id: string; scheme: string; portfolio_submitted_at: string | null; outcome: string | null; assessor_day_booked_at: string | null; assessor_day_completed_at: string | null }[] })
      : admin
          .from("tit_records")
          .select("course_tutors_id, scheme, portfolio_submitted_at, outcome, assessor_day_booked_at, assessor_day_completed_at")
          .in("course_tutors_id", access.visible.map((t) => t.id)),
  ]);
  const ids = new Set<string>();
  for (const t of access.all) {
    ids.add(t.profile_id);
    if (t.supervisor_profile_id) ids.add(t.supervisor_profile_id);
  }
  for (const t of tutorsOnCourse ?? []) ids.add(t.profile_id);
  for (const g of grants ?? []) {
    ids.add(g.grantee_profile_id);
    ids.add(g.granted_by_profile_id);
    if (g.revoked_by_profile_id) ids.add(g.revoked_by_profile_id);
  }
  const { data: people } = await admin.from("profiles").select("id, full_name").in("id", [...ids]);
  const nameOf = (id: string | null) => (id ? ((people ?? []).find((p) => p.id === id)?.full_name ?? "Unknown") : null);
  const mctNames = (tutorsOnCourse ?? []).filter((t) => t.tutor_role === "main_course_tutor").map((t) => nameOf(t.profile_id) ?? "Unknown");

  const supabase = trainer ? await createClient() : null;

  return (
    <div className="flex flex-col gap-6">
      {heading}
      {access.visible.map((ct) => {
        const grantsFor = (grants ?? []).filter((g) => g.course_tutors_id === ct.id);
        const liveGranteeIds = new Set(grantsFor.filter((g) => !g.revoked_at).map((g) => g.grantee_profile_id));
        const grantable = (tutorsOnCourse ?? [])
          .filter(
            (t) =>
              t.profile_id !== ct.profile_id &&
              t.profile_id !== ct.supervisor_profile_id &&
              t.tutor_role !== "main_course_tutor" &&
              t.tutor_role !== "external_assessor" &&
              !liveGranteeIds.has(t.profile_id)
          )
          .map((t) => ({ id: t.profile_id, name: nameOf(t.profile_id) ?? "Unknown" }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const grantViews: AccessGrantView[] = grantsFor.map((g) => ({
          id: g.id,
          granteeName: nameOf(g.grantee_profile_id) ?? "Unknown",
          grantedByName: nameOf(g.granted_by_profile_id) ?? "Unknown",
          reason: g.reason,
          grantedAt: g.granted_at,
          revokedAt: g.revoked_at,
          revokedByName: nameOf(g.revoked_by_profile_id),
        }));
        const record = (records ?? []).find((r) => r.course_tutors_id === ct.id);
        return (
          <div key={ct.id} className="flex flex-col gap-6">
            {supabase ? (
              <TitWorkspace supabase={supabase} courseTutor={ct} />
            ) : (
              // The assessor's read-only view: the record's state, not its
              // working forms. Handbook §5.2.1 -- the assessor's own TinT
              // day is where they see the rest.
              <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-card px-[22px] py-5 text-sm">
                <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">{nameOf(ct.profile_id)} · read-only</p>
                <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-1.5">
                  <dt className="text-muted">Verified</dt>
                  <dd className="text-ink">{ct.verified_at ? new Date(ct.verified_at).toLocaleDateString("en-GB") : "Not yet"}</dd>
                  <dt className="text-muted">Supervisor</dt>
                  <dd className="text-ink">{nameOf(ct.supervisor_profile_id) ?? "Not set"}</dd>
                  <dt className="text-muted">Scheme</dt>
                  <dd className="text-ink">{record?.scheme ?? "Not recorded"}</dd>
                  <dt className="text-muted">Assessor day</dt>
                  <dd className="text-ink">
                    {record?.assessor_day_completed_at
                      ? `Completed ${new Date(record.assessor_day_completed_at).toLocaleDateString("en-GB")}`
                      : record?.assessor_day_booked_at
                        ? `Booked ${new Date(record.assessor_day_booked_at).toLocaleDateString("en-GB")}`
                        : "Not booked"}
                  </dd>
                  <dt className="text-muted">Portfolio</dt>
                  <dd className="text-ink">
                    {record?.portfolio_submitted_at ? `Submitted ${new Date(record.portfolio_submitted_at).toLocaleDateString("en-GB")}` : "Not submitted"}
                  </dd>
                  <dt className="text-muted">Outcome</dt>
                  <dd className="text-ink">{record?.outcome?.replace(/_/g, " ") ?? "Not decided"}</dd>
                </dl>
              </section>
            )}
            <AccessPanel
              courseTutorsId={ct.id}
              tintName={nameOf(ct.profile_id) ?? "Unknown"}
              supervisorName={nameOf(ct.supervisor_profile_id)}
              mctNames={mctNames}
              grants={grantViews}
              canManage={Boolean(trainer) && isMct}
              grantable={grantable}
            />
          </div>
        );
      })}
    </div>
  );
}
