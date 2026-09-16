import { TIMEZONE_OPTIONS } from "@/lib/timezones";
import { formatDateTime } from "@/lib/format-date";

/**
 * Centre settings, for a role that reads and changes nothing.
 *
 * Ramy, 15 Sep 2026. The Centre observer "wants the numbers, changes
 * nothing", and Settings was the one room that gave them nothing at all:
 * both tabs answered "you don't hold a role that can edit centre settings"
 * and stopped there, so a role whose entire job is reading could not see the
 * centre's own name, number, address, contact, time zone or currency.
 *
 * Deliberately not the edit form with its inputs disabled. A greyed-out form
 * reads as something broken or not yet yours; a plain list of facts reads as
 * a reference, which is what this is. The connections say whether they are
 * connected and when -- never a control, and never a credential.
 */
function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border-faint py-3 first:border-none first:pt-0 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="w-[210px] shrink-0 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{label}</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-ink">{value}</span>
        {note ? <span className="text-xs text-muted">{note}</span> : null}
      </div>
    </div>
  );
}

function Connection({ title, blurb, status }: { title: string; blurb: string; status: string }) {
  return (
    <div className="card p-5">
      <h3 className="font-serif text-base text-ink">{title}</h3>
      <p className="mt-1 text-sm text-muted">{blurb}</p>
      <p className="mt-3 text-sm text-ink">{status}</p>
    </div>
  );
}

export function CentreProfileReadOnly({
  name,
  centerNumber,
  address,
  primaryContactEmail,
  timeZone,
  currency,
  appianUrl,
  filmsTpSessions,
  driveConnectedAt,
  zoomConnectedAt,
  zoomAccountEmail,
  paymentProvider,
  paymentProviderConnectedAt,
}: {
  name: string;
  centerNumber: string;
  address: string | null;
  primaryContactEmail: string | null;
  timeZone: string;
  currency: string | null;
  appianUrl: string | null;
  filmsTpSessions: boolean;
  driveConnectedAt: string | null;
  zoomConnectedAt: string | null;
  zoomAccountEmail: string | null;
  paymentProvider: string | null;
  paymentProviderConnectedAt: string | null;
}) {
  const zoneLabel = TIMEZONE_OPTIONS.find((t) => t.value === timeZone)?.label ?? timeZone;
  const notSet = "Not set";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Your role reads the centre and changes nothing, so this is the record rather than the form. A Centre manager or
        the Centre owner edits it.
      </p>

      <div className="card flex flex-col p-5">
        <Row label="Centre name" value={name} />
        <Row label="Cambridge centre number" value={centerNumber} note="Set by Cambridge, not editable in Connect." />
        <Row label="Address" value={address || notSet} />
        <Row label="Primary contact email" value={primaryContactEmail || notSet} />
        <Row
          label="Time zone"
          value={zoneLabel}
          note={'Drives every "today" and "is this due" check for this centre.'}
        />
        <Row label="Currency" value={currency || notSet} note="Applies to every course unless a course overrides it." />
        <Row label="Appian sign-in URL" value={appianUrl || notSet} />
        <Row
          label="Films teaching practice"
          value={filmsTpSessions ? "Yes" : "No"}
          note={filmsTpSessions ? "Filming consent is tracked on every course roster." : undefined}
        />
      </div>

      <Connection
        title="Google Drive"
        blurb="Used for the one-time sheet import and for centres that keep their own copy of resource-hub documents."
        status={driveConnectedAt ? `Connected ${formatDateTime(driveConnectedAt, timeZone)}.` : "Not connected."}
      />

      <Connection
        title="Zoom"
        blurb="Fills in a TP session's attendance register from who joined and left the meeting."
        status={
          zoomConnectedAt
            ? `Connected ${formatDateTime(zoomConnectedAt, timeZone)}${zoomAccountEmail ? ` · ${zoomAccountEmail}` : ""}.`
            : "Not connected."
        }
      />

      <Connection
        title="Payments"
        blurb="Connect never holds or moves money. It stores a reference to a payment made through the centre's own provider."
        status={
          paymentProvider
            ? `${paymentProvider.replace(/^./, (c) => c.toUpperCase())}${
                paymentProviderConnectedAt ? `, connected ${formatDateTime(paymentProviderConnectedAt, timeZone)}` : ""
              }.`
            : "No provider connected."
        }
      />
    </div>
  );
}
