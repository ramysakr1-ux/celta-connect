import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectGoogleDrive, updateAutoTagCriteria } from "@/app/dashboard/admin/settings/actions";
import { CenterProfileForm } from "@/app/dashboard/admin/settings/center-profile-form";
import { GoogleDriveTargetsForm } from "@/app/dashboard/admin/settings/targets-form";
import { FeedbackStyleExamplesManager } from "@/components/feedback-style-examples/manager";
import { TutorsPanel, type TutorsCourseGroup } from "@/app/dashboard/admin/settings/tutors-panel";
import { MalpracticeOutcomesManager } from "@/app/dashboard/admin/settings/malpractice-outcomes-manager";
import { AssignmentCriteriaManager } from "@/app/dashboard/admin/settings/assignment-criteria-manager";
import { SettingsNav } from "@/app/dashboard/admin/settings/settings-nav";
import type { DeliveryMode } from "@/lib/delivery-mode";
import { LaptopOnlyGate } from "@/components/laptop-only-gate";

const SETTINGS_NAV_BASE = [
  { href: "#centre-profile", label: "Centre profile" },
  { href: "#auto-tagging", label: "TP feedback tagging" },
  { href: "#google-drive", label: "Google Drive" },
  { href: "/dashboard/admin/assignment-briefs", label: "Assignment briefs", external: true },
  { href: "#feedback-style", label: "Feedback style" },
  { href: "#tutors", label: "Tutors" },
  { href: "#malpractice-outcomes", label: "Malpractice outcomes" },
] as const;

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "That connection attempt looked invalid, so it was rejected. Try again.",
  token_exchange_failed: "Google didn't confirm the connection. Try again.",
  access_denied: "Google Drive access was not granted.",
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google_connected?: string; google_error?: string }>;
}) {
  const profile = await requireRole("admin");
  const { google_connected, google_error } = await searchParams;

  const admin = createAdminClient();
  const { data: center } = await admin
    .from("centers")
    .select(
      "name, center_number, is_uk_centre, auto_tag_criteria_enabled, admissions_email, volunteer_certificate_hours_threshold, application_response_hours"
    )
    .eq("id", profile.center_id)
    .maybeSingle();
  const { data: connection } = await admin
    .from("center_google_connections")
    .select("center_id, template_doc_id, output_folder_id, connected_at")
    // single-centre: per-centre configuration; there is no editing every branch's settings at once
    .eq("center_id", profile.center_id)
    .maybeSingle();

  // Whether a Drive is actually connected, rather than whether one was just
  // connected in this request's query string.
  const { data: driveRow } = await admin
    .from("center_google_connections")
    .select("center_id")
    // single-centre: per-centre configuration; there is no editing every branch's settings at once
    .eq("center_id", profile.center_id)
    .maybeSingle();
  const driveConnected = Boolean(driveRow);

  const { data: styleExamples } = await admin
    .from("feedback_style_examples")
    .select("*")
    // single-centre: per-centre configuration; there is no editing every branch's settings at once
    .eq("center_id", profile.center_id)
    .order("created_at", { ascending: false });

  const { data: malpracticeOutcomes } = await admin
    .from("malpractice_outcome_options")
    .select("*")
    // single-centre: per-centre configuration; there is no editing every branch's settings at once
    .eq("center_id", profile.center_id)
    .order("created_at", { ascending: true });

  const { data: assignmentCriteria } = await admin
    .from("centre_assignment_criteria")
    .select("*")
    // single-centre: per-centre configuration; there is no editing every branch's settings at once
    .eq("center_id", profile.center_id)
    .order("sort_order", { ascending: true });

  // Tutors panel -- real per-course tutor management over course_tutors
  // (0051), previously zero app code touched this table at all. Grouped by
  // course so the online-experience column only appears where the
  // Handbook actually requires it (online/mixed courses).
  const { data: centerCourses } = await admin
    .from("courses")
    .select("id, name, delivery_mode")
    // single-centre: per-centre configuration; there is no editing every branch's settings at once
    .eq("center_id", profile.center_id)
    .order("start_date", { ascending: false });
  const courseIds = (centerCourses ?? []).map((c) => c.id);

  const [{ data: tutorRows }, { data: centerTrainers }] = await Promise.all([
    courseIds.length > 0
      ? admin
          .from("course_tutors")
          .select("*")
          .in("course_id", courseIds)
          .is("left_at", null)
      : Promise.resolve({ data: [] }),
    // single-centre: per-centre configuration; there is no editing every branch's settings at once
    admin.from("profiles").select("id, full_name").eq("center_id", profile.center_id).eq("role", "trainer"),
  ]);

  const trainerNameById = new Map((centerTrainers ?? []).map((t) => [t.id, t.full_name]));
  const supervisorOptions = (centerTrainers ?? []).map((t) => ({ id: t.id, name: t.full_name }));

  const tutorGroups: TutorsCourseGroup[] = (centerCourses ?? [])
    .map((course) => ({
      courseId: course.id,
      courseName: course.name,
      deliveryMode: course.delivery_mode as DeliveryMode,
      tutors: (tutorRows ?? [])
        .filter((t) => t.course_id === course.id)
        .map((t) => ({
          id: t.id,
          tutorName: trainerNameById.get(t.profile_id) ?? "Unknown",
          tutorRole: t.tutor_role,
          isTrainerInTraining: t.is_trainer_in_training,
          verifiedAt: t.verified_at,
          supervisorProfileId: t.supervisor_profile_id,
          onlineExperienceEvidenced: t.online_experience_evidenced,
          onlineExperienceNote: t.online_experience_note,
        })),
    }))
    .filter((g) => g.tutors.length > 0);

  // "A red dot flag if something there needs attention." Each reads real
  // state -- a flag that is sometimes wrong is worse than none, because people
  // stop trusting it and then miss the one that mattered.
  const settingsNavItems = SETTINGS_NAV_BASE.map((item) => {
    let needsAttention: string | null = null;
    if (item.href === "#centre-profile" && center?.center_number?.startsWith("PENDING-")) {
      needsAttention = "The Cambridge centre number is still a placeholder, and it prints on every report.";
    }
    if (item.href === "#google-drive" && !driveConnected) {
      needsAttention = "No Drive connected — a closed course has nowhere to export to.";
    }
    if (item.href === "#feedback-style" && (styleExamples ?? []).length === 0) {
      needsAttention = "No examples yet, so there is nothing to match the centre's tone against.";
    }
    if (item.href === "#tutors" && tutorGroups.some((g) => g.tutors.some((t) => !t.verifiedAt))) {
      needsAttention = "A tutor has no Cambridge verification date on file.";
    }
    return { ...item, needsAttention };
  });

  return (
    <LaptopOnlyGate task="Centre setup">
    <div className="flex flex-col gap-6">
      {/* Only reached from the Centre material panel now (the persistent
          AdminTabs nav that used to link here is gone -- see dashboard/
          admin/page.tsx). A real way back, so this can't be a dead end. */}
      <BackLink href="/dashboard/admin" label={"Courses"} />
      <div className="card card-garnet p-6">
        <h1 className="font-serif text-xl text-ink">Settings</h1>
        <p className="mt-2 text-muted">Centre-level integrations and configuration.</p>
      </div>

      <div className="grid grid-cols-[232px_1fr] items-start gap-5">
        <SettingsNav items={settingsNavItems} />

        <div className="flex flex-col gap-5">
          <div id="centre-profile" className="card card-gold scroll-mt-6 p-6">
            <h2 className="font-serif text-lg text-ink">Centre profile</h2>
            <p className="mt-2 text-muted">
              Your centre&apos;s name and Cambridge-assigned centre number -- shown on every course,
              the final report, and your own record pages.
            </p>
            <div className="mt-4">
              <CenterProfileForm
                name={center?.name ?? ""}
                centerNumber={center?.center_number ?? ""}
                isUkCentre={center?.is_uk_centre ?? false}
                admissionsEmail={center?.admissions_email ?? null}
                volunteerCertificateHoursThreshold={center?.volunteer_certificate_hours_threshold ?? 160}
                applicationResponseHours={center?.application_response_hours ?? 10}
              />
            </div>
          </div>

          <div id="auto-tagging" className="card scroll-mt-6 p-6">
            <h2 className="font-serif text-lg text-ink">TP feedback tagging</h2>
            <p className="mt-2 text-muted">
              As a trainer types a feedback bullet, matching CELTA criteria codes land on it
              automatically -- no clicking through the criteria panel. On by default; the manual
              &quot;+ criteria&quot; panel always stays available either way.
            </p>
            <form action={updateAutoTagCriteria} className="mt-4 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="auto_tag_criteria_enabled" defaultChecked={center?.auto_tag_criteria_enabled ?? true} />
                Auto-tag criteria while typing TP feedback
              </label>
              <button type="submit" className="admin-hover-fill rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary">
                Save
              </button>
            </form>
          </div>

          <div id="google-drive" className="card card-gold scroll-mt-6 p-6">
            <h2 className="font-serif text-lg text-ink">Google Drive</h2>
            <p className="mt-2 text-muted">
              Connect your centre&apos;s Google Drive so CELTA5 records can be kept in sync with your
              official template document.
            </p>

            {google_connected ? (
              <p className="mt-4 rounded-[6px] border border-primary bg-primary/10 px-3 py-2 text-sm text-ink">
                Google Drive connected.
              </p>
            ) : null}
            {google_error ? (
              <p className="mt-4 rounded-[6px] border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {GOOGLE_ERROR_MESSAGES[google_error] ?? "Something went wrong connecting Google Drive."}
              </p>
            ) : null}

            {connection ? (
              <div className="mt-4 flex flex-col gap-4">
                <p className="text-sm text-muted">
                  Connected{" "}
                  {new Date(connection.connected_at).toLocaleString()}.
                </p>
                <GoogleDriveTargetsForm
                  templateDocId={connection.template_doc_id}
                  outputFolderId={connection.output_folder_id}
                />
                <form action={disconnectGoogleDrive}>
                  <button type="submit" className="text-sm text-destructive underline">
                    Disconnect Google Drive
                  </button>
                </form>
              </div>
            ) : (
              <a
                href="/api/google/connect"
                className="mt-4 inline-block rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card"
              >
                Connect Google Drive
              </a>
            )}
          </div>

          <div id="feedback-style" className="card card-garnet scroll-mt-6 p-6">
            <h2 className="font-serif text-lg text-ink">Feedback Style Examples</h2>
            <p className="mt-2 text-muted">
              Real feedback snippets used to guide the AI tone-cleanup feature on trainer feedback
              fields. Added once, reused automatically on every rewrite.
            </p>
            <div className="mt-4">
              <FeedbackStyleExamplesManager examples={styleExamples ?? []} />
            </div>
          </div>

          <div id="tutors" className="card card-gold scroll-mt-6 p-6">
            <h2 className="font-serif text-lg text-ink">Tutors</h2>
            <p className="mt-2 text-muted">
              Who&apos;s teaching each course at this centre, their role, trainer-in-training status, and
              (on online or mixed-mode courses) evidence of online teaching experience.
            </p>
            <div className="mt-4">
              <TutorsPanel groups={tutorGroups} supervisorOptions={supervisorOptions} />
            </div>
          </div>

          <div id="malpractice-outcomes" className="card scroll-mt-6 p-6">
            <h2 className="font-serif text-lg text-ink">Malpractice outcomes</h2>
            <p className="mt-2 text-muted">
              Handbook 9.2.4 requires your own internal policy on plagiarism/malpractice penalties --
              Connect never invents one. Add each outcome your policy names, and whether it fails the
              assignment and/or refers the case to your own procedure. A tutor deciding a case picks
              from this list. Leave it empty to keep the plain Upheld / Not upheld decision.
            </p>
            <div className="mt-4">
              <MalpracticeOutcomesManager options={malpracticeOutcomes ?? []} />
            </div>
          </div>

          <div id="assignment-criteria" className="card card-gold scroll-mt-6 p-6">
            <h2 className="font-serif text-lg text-ink">Assignment marking criteria</h2>
            <p className="mt-2 text-muted">
              The fixed brief and word count stay as they are -- this is the grey area, where centres and tutors
              reasonably differ on what counts. Shipped with Cambridge&apos;s own defaults; add or deactivate to match
              your own standardisation. Deactivating keeps it on any record it&apos;s already part of, it just stops
              being offered for new marking.
            </p>
            <div className="mt-4">
              <AssignmentCriteriaManager criteria={assignmentCriteria ?? []} />
            </div>
          </div>
        </div>
      </div>
    </div>
    </LaptopOnlyGate>
  );
}
