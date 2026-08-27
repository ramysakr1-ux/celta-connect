"use client";

import { disconnectZoom } from "@/app/dashboard/admin/settings/actions";

export function ZoomConnectionForm({
  connection,
  connected,
  error,
}: {
  connection: { connected_at: string; zoom_account_email: string | null } | null;
  connected?: boolean;
  error?: string;
}) {
  return (
    <div className="card px-[22px] py-5">
      <h3 className="font-serif text-base text-ink">Zoom</h3>
      <p className="mt-1 text-sm text-muted">
        Connects Zoom&apos;s webhook so joining/leaving a TP session&apos;s meeting fills in the attendance register
        automatically. Manual entry stays available as the correction path -- this only adds a second, automatic way
        the register gets filled in.
      </p>
      {connected ? <p className="mt-3 text-sm text-primary">Zoom connected.</p> : null}
      {error ? (
        <p className="mt-3 text-sm text-destructive">
          {ZOOM_ERROR_MESSAGES[error] ?? "Something went wrong connecting Zoom."}
        </p>
      ) : null}
      {connection ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-muted">
            Connected {new Date(connection.connected_at).toLocaleString()}
            {connection.zoom_account_email ? ` as ${connection.zoom_account_email}` : ""}.
          </p>
          <form action={disconnectZoom}>
            <button type="submit" className="text-sm text-destructive underline">
              Disconnect Zoom
            </button>
          </form>
        </div>
      ) : (
        <a href="/api/zoom/connect" className="mt-4 inline-block rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card">
          Connect Zoom
        </a>
      )}
    </div>
  );
}

const ZOOM_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "That connection attempt looked invalid, so it was rejected. Try again.",
  token_exchange_failed: "Zoom didn't confirm the connection. Try again.",
  access_denied: "Zoom access was not granted.",
};
