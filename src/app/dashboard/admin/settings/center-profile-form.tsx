"use client";

import { useActionState, useState } from "react";
import { updateCenterProfile, type FormState } from "@/app/dashboard/admin/settings/actions";

const initialState: FormState = { error: null };

export function CenterProfileForm({
  name,
  centerNumber,
  isUkCentre,
  admissionsEmail,
  chatRetentionDays,
}: {
  name: string;
  centerNumber: string;
  isUkCentre: boolean;
  admissionsEmail: string | null;
  chatRetentionDays: number;
}) {
  const [state, action, pending] = useActionState(updateCenterProfile, initialState);
  const isPlaceholder = centerNumber.startsWith("PENDING-");

  const initialPreset = chatRetentionDays === 1 ? "nightly" : chatRetentionDays === 7 ? "weekly" : "custom";
  const [retentionPreset, setRetentionPreset] = useState<"nightly" | "weekly" | "custom">(initialPreset);
  const [customDays, setCustomDays] = useState(chatRetentionDays);
  const effectiveDays = retentionPreset === "nightly" ? 1 : retentionPreset === "weekly" ? 7 : customDays;

  return (
    <form action={action} className="flex flex-col gap-4">
      {isPlaceholder ? (
        <p className="rounded-[6px] border border-primary bg-primary/10 px-3 py-2 text-sm text-ink">
          This centre number is still a placeholder, auto-generated when the centre was set up.
          Replace it with the real Cambridge-assigned number below.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="center_name" className="text-sm text-muted">
          Centre name
        </label>
        <input
          id="center_name"
          name="name"
          type="text"
          required
          defaultValue={name}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="center_number" className="text-sm text-muted">
          Centre number
        </label>
        <input
          id="center_number"
          name="center_number"
          type="text"
          required
          defaultValue={isPlaceholder ? "" : centerNumber}
          placeholder="e.g. UK123"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
        <p className="text-xs text-muted">
          Every course this centre runs shares this number -- it&apos;s set once here, not per
          course.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="is_uk_centre" defaultChecked={isUkCentre} />
        This centre is based in the UK
      </label>
      <p className="-mt-2 text-xs text-muted">
        Shows a Unique Learner Number field on the trainee join form -- required for UK education
        and training records, not used elsewhere.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admissions_email" className="text-sm text-muted">
          Admissions reply-to address
        </label>
        <input
          id="admissions_email"
          name="admissions_email"
          type="email"
          defaultValue={admissionsEmail ?? ""}
          placeholder="admissions@yourcentre.example"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
        <p className="text-xs text-muted">
          Where replies to applicant emails (offers, rejections) land. Every email is sent from your
          centre&apos;s name, never Connect&apos;s.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="chat_retention_preset" className="text-sm text-muted">
          Chat retention
        </label>
        <select
          id="chat_retention_preset"
          value={retentionPreset}
          onChange={(e) => setRetentionPreset(e.target.value as "nightly" | "weekly" | "custom")}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        >
          <option value="nightly">Nightly (1 day)</option>
          <option value="weekly">Weekly (7 days)</option>
          <option value="custom">Custom</option>
        </select>
        {retentionPreset === "custom" ? (
          <input
            type="number"
            min={1}
            value={customDays}
            onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 1))}
            className="w-24 rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
          />
        ) : null}
        <input type="hidden" name="chat_retention_days" value={effectiveDays} />
        <p className="text-xs text-muted">
          A rolling window, not a fixed reset time -- a message is deleted once it&apos;s this many days old.
          Applies to every chat channel (trainer and trainee alike), never set separately per role.
        </p>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
