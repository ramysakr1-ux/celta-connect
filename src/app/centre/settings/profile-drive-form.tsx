"use client";

import { useActionState } from "react";
import { updateCentreProfile, type FormState } from "@/app/centre/settings/actions";
import { disconnectGoogleDrive } from "@/app/dashboard/admin/settings/actions";
import { GoogleDriveTargetsForm } from "@/app/dashboard/admin/settings/targets-form";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";

const initialState: FormState = { error: null };

export function ProfileDriveForm({
  name,
  centerNumber,
  address,
  primaryContactEmail,
  timeZone,
  currency,
  appianUrl,
  filmsTpSessions,
  driveConnection,
}: {
  name: string;
  centerNumber: string;
  address: string | null;
  primaryContactEmail: string | null;
  timeZone: string;
  currency: string | null;
  appianUrl: string | null;
  filmsTpSessions: boolean;
  driveConnection: { connected_at: string; template_doc_id: string | null; output_folder_id: string | null } | null;
}) {
  const [state, action, pending] = useActionState(updateCentreProfile, initialState);

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cs_name" className="text-sm text-muted">
            Centre name
          </label>
          <input
            id="cs_name"
            name="name"
            type="text"
            required
            defaultValue={name}
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cs_number" className="text-sm text-muted">
            Cambridge centre number
          </label>
          <input
            id="cs_number"
            type="text"
            readOnly
            value={centerNumber}
            className="rounded-[6px] border border-border bg-surface-muted/50 px-3 py-2 text-muted"
          />
          <p className="text-xs text-muted">Set by Cambridge, not editable here.</p>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="cs_address" className="text-sm text-muted">
            Address
          </label>
          <input
            id="cs_address"
            name="address"
            type="text"
            defaultValue={address ?? ""}
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cs_contact_email" className="text-sm text-muted">
            Primary contact email
          </label>
          <input
            id="cs_contact_email"
            name="primary_contact_email"
            type="email"
            defaultValue={primaryContactEmail ?? ""}
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cs_timezone" className="text-sm text-muted">
            Time zone
          </label>
          <select
            id="cs_timezone"
            name="time_zone"
            required
            defaultValue={timeZone}
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">
            Drives every &quot;today&quot;/&quot;is this due&quot; check for this centre -- attendance day counts, payment due dates, timetable grouping.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cs_currency" className="text-sm text-muted">
            Currency
          </label>
          <input
            id="cs_currency"
            name="currency"
            type="text"
            placeholder="e.g. TRY"
            defaultValue={currency ?? ""}
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
          />
          <p className="text-xs text-muted">Applies to every course unless a course overrides it.</p>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="cs_appian_url" className="text-sm text-muted">
            Appian sign-in URL
          </label>
          <input
            id="cs_appian_url"
            name="appian_url"
            type="url"
            placeholder="https://celta.appiancloud.com"
            defaultValue={appianUrl ?? ""}
            className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-ink outline-none focus:border-primary"
          />
          <p className="text-xs text-muted">
            Cambridge gives every centre the same sign-in link -- Course Admin&apos;s Entry Form card opens this,
            not a per-course link.
          </p>
        </div>

        <div className="flex items-start gap-2.5 sm:col-span-2">
          <input
            id="cs_films"
            name="films_tp_sessions"
            type="checkbox"
            defaultChecked={filmsTpSessions}
            className="mt-0.5 size-4 rounded border-border"
          />
          <label htmlFor="cs_films" className="text-sm text-ink">
            This centre films teaching practice sessions
            <span className="block text-xs text-muted">
              Turns on filming consent tracking on every course roster. Off by default -- most centres don&apos;t film.
            </span>
          </label>
        </div>

        <div className="sm:col-span-2">
          {state.error ? <p className="mb-2 text-sm text-destructive">{state.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <div className="card px-[22px] py-5">
        <h3 className="font-serif text-base text-ink">Google Drive</h3>
        <p className="mt-1 text-sm text-muted">
          Used for the one-time sheet import and for centres that keep their own copy of resource-hub documents.
          Read-only, per file — never a live sync.
        </p>
        {driveConnection ? (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-sm text-muted">Connected {new Date(driveConnection.connected_at).toLocaleString()}.</p>
            <GoogleDriveTargetsForm templateDocId={driveConnection.template_doc_id} outputFolderId={driveConnection.output_folder_id} />
            <form action={disconnectGoogleDrive}>
              <button type="submit" className="text-sm text-destructive underline">
                Disconnect Google Drive
              </button>
            </form>
          </div>
        ) : (
          <a href="/api/google/connect" className="mt-4 inline-block rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card">
            Connect Google Drive
          </a>
        )}
      </div>
    </div>
  );
}
