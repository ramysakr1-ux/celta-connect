import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectGoogleDrive } from "@/app/dashboard/admin/settings/actions";
import { GoogleDriveTargetsForm } from "@/app/dashboard/admin/settings/targets-form";

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
  const { data: connection } = await admin
    .from("center_google_connections")
    .select("center_id, template_doc_id, output_folder_id, connected_at")
    .eq("center_id", profile.center_id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">Settings</h1>
        <p className="mt-2 text-muted">Center-level integrations and configuration.</p>
      </div>

      <div className="card p-6">
        <h2 className="font-serif text-lg text-ink">Google Drive</h2>
        <p className="mt-2 text-muted">
          Connect your center&apos;s Google Drive so CELTA5 records can be kept in sync with your
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
    </div>
  );
}
