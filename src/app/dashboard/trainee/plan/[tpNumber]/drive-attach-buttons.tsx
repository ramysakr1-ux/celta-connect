"use client";

import { useState } from "react";
import { openDrivePicker } from "@/lib/google/picker-client";
import {
  addSlidesLink,
  getCenterDriveAccessToken,
} from "@/app/dashboard/trainee/plan/[tpNumber]/materials-actions";

export function DriveAttachButtons({
  tpPlanId,
  onError,
}: {
  tpPlanId: string;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  async function handleCenterDrive() {
    if (!apiKey) {
      onError("Google Drive isn't configured for this app yet.");
      return;
    }
    onError(null);
    setBusy(true);
    try {
      const result = await getCenterDriveAccessToken();
      if ("error" in result) {
        onError(result.error);
        return;
      }
      await openDrivePicker({
        accessToken: result.accessToken,
        apiKey,
        onPicked: async (file) => {
          const linkResult = await addSlidesLink({ tpPlanId, slidesUrl: file.url, fileName: file.name });
          if (linkResult.error) onError(linkResult.error);
        },
      });
    } catch {
      onError("Could not open the Drive picker. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCenterDrive}
      disabled={busy}
      className="self-start rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary disabled:opacity-50"
    >
      {busy ? "Opening…" : "Attach from centre's Drive"}
    </button>
  );
}
