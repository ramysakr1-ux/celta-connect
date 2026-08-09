import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectGoogleDrive } from "@/app/dashboard/admin/settings/actions";
import { CenterProfileForm } from "@/app/dashboard/admin/settings/center-profile-form";
import { GoogleDriveTargetsForm } from "@/app/dashboard/admin/settings/targets-form";
import { FeedbackStyleExamplesManager } from "@/components/feedback-style-examples/manager";
import { TutorsPanel, type TutorsCourseGroup } from "@/app/dashboard/admin/settings/tutors-panel";
import type { DeliveryMode } from "@/lib/delivery-mode";

const SETTINGS_NAV = [
  { href: "#centre-profile", label: "Centre profile" },
  { href: "#google-drive", label: "Google Drive" },
  { href: "/dashboard/admin/assignment-briefs", label: "Assignment briefs", external: true },
  { href: "#feedback-style", label: "Feedback style" },
  { href: "#tutors", label: "Tutors" },
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
    .select("name, center_number")
    .eq("id", profile.center_id)
    .maybeSingle();
  const { data: connection } = await admin
    .from("center_google_connections")
    .select("center_id, template_doc_id, output_folder_id, connected_at")
    .eq("center_id", profile.center_id)
    .maybeSingle();

  const { data: styleExamples } = await admin
    .from("feedback_style_examples")
    .select("*")
    .eq("center_id", profile.center_id)
    .order("created_at", { ascending: false });

  // Tutors panel -- real per-course tutor management over course_tutors
  // (0051), previously zero app code touched this table at all. Grouped by
  // course so the online-experience column only appears where the
  // Handbook actually requires it (online/mixed courses).
  const { data: centerCourses } = await admin
    .from("courses")
    .select("id, name, delivery_mode")
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

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">Settings</h1>
        <p className="mt-2 text-muted">Centre-level integrations and configuration.</p>
      </div>

      <div className="grid grid-cols-[232px_1fr] items-start gap-5">
        <nav className="sticky top-4 flex flex-col gap-0.5 rounded-[6px] border border-border bg-card py-3.5">
          <p className="px-4 pb-2 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Settings</p>
          {SETTINGS_NAV.map((item) =>
            "external" in item && item.external ? (
              <Link key={item.href} href={item.href} className="px-4 py-2 text-sm text-muted hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <a key={item.href} href={item.href} className="px-4 py-2 text-sm text-muted hover:text-ink">
                {item.label}
              </a>
            )
          )}
        </nav>

        <div className="flex flex-col gap-5">
          <div id="centre-profile" className="card scroll-mt-6 p-6">
            <h2 className="font-serif text-lg text-ink">Centre profile</h2>
            <p className="mt-2 text-muted">
              Your centre&apos;s name and Cambridge-assigned centre number -- shown on every course,
              the final report, and your own record pages.
            </p>
            <div className="mt-4">
              <CenterProfileForm name={center?.name ?? ""} centerNumber={center?.center_number ?? ""} />
            </div>
          </div>

          <div id="google-drive" className="card scroll-mt-6 p-6">
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

          <div id="feedback-style" className="card scroll-mt-6 p-6">
            <h2 className="font-serif text-lg text-ink">Feedback Style Examples</h2>
            <p className="mt-2 text-muted">
              Real feedback snippets used to guide the AI tone-cleanup feature on trainer feedback
              fields. Added once, reused automatically on every rewrite.
            </p>
            <div className="mt-4">
              <FeedbackStyleExamplesManager examples={styleExamples ?? []} />
            </div>
          </div>

          <div id="tutors" className="card scroll-mt-6 p-6">
            <h2 className="font-serif text-lg text-ink">Tutors</h2>
            <p className="mt-2 text-muted">
              Who&apos;s teaching each course at this centre, their role, trainer-in-training status, and
              (on online or mixed-mode courses) evidence of online teaching experience.
            </p>
            <div className="mt-4">
              <TutorsPanel groups={tutorGroups} supervisorOptions={supervisorOptions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
