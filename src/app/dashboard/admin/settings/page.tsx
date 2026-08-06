import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectGoogleDrive } from "@/app/dashboard/admin/settings/actions";
import { CenterProfileForm } from "@/app/dashboard/admin/settings/center-profile-form";
import { GoogleDriveTargetsForm } from "@/app/dashboard/admin/settings/targets-form";
import { FeedbackStyleExamplesManager } from "@/components/feedback-style-examples/manager";

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

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">Settings</h1>
        <p className="mt-2 text-muted">Centre-level integrations and configuration.</p>
      </div>

      <div className="card p-6">
        <h2 className="font-serif text-lg text-ink">Centre profile</h2>
        <p className="mt-2 text-muted">
          Your centre&apos;s name and Cambridge-assigned centre number -- shown on every course,
          the final report, and your own record pages.
        </p>
        <div className="mt-4">
          <CenterProfileForm name={center?.name ?? ""} centerNumber={center?.center_number ?? ""} />
        </div>
      </div>

      <div className="card p-6">
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

      <div className="card p-6">
        <h2 className="font-serif text-lg text-ink">Feedback Style Examples</h2>
        <p className="mt-2 text-muted">
          Real feedback snippets used to guide the AI tone-cleanup feature on trainer feedback
          fields. Added once, reused automatically on every rewrite.
        </p>
        <div className="mt-4">
          <FeedbackStyleExamplesManager examples={styleExamples ?? []} />
        </div>
      </div>
    </div>
  );
}
