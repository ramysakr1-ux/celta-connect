import type { SignatureLedgerRow } from "@/lib/celta5-signatures";
import { isBookletExportReady } from "@/lib/celta5-signatures";
import { formatDateTime as fmtDateTime } from "@/lib/format-date";

const STATE_LABEL: Record<SignatureLedgerRow["state"], string> = {
  signed: "Signed",
  ready: "Ready",
  open: "Open",
  locked: "Locked",
};

const STATE_CLASS: Record<SignatureLedgerRow["state"], string> = {
  signed: "status-pill-on-track",
  ready: "status-pill-pending",
  open: "status-pill-pending",
  locked: "status-pill-at-risk",
};

function formatDateTime(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  return fmtDateTime(iso, timeZone);
}

// Area 4 -- one place that lists every signature the booklet needs, reading
// the timestamp columns that already scatter across celta5_records and
// assignments rather than a new table (computeSignatureLedger owns the
// mapping). The booklet export button lives here too since its gate is
// exactly "every row below is Signed."
export function SignatureLedger({ rows, traineeId, timeZone }: { rows: SignatureLedgerRow[]; traineeId: string; timeZone: string }) {
  const ready = isBookletExportReady(rows);

  return (
    <div className="sheet">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-h3 text-ink">Signatures</h3>
        <div className="flex shrink-0 items-center gap-2">
          {ready ? (
            <>
              <a
                href={`/api/portfolio/${traineeId}/celta5/booklet`}
                className="wash rounded-[6px] border border-border px-3 py-1.5 text-body text-ink"
              >
                Export CELTA 5 booklet
              </a>
              <a
                href={`/api/portfolio/${traineeId}/celta5/replica`}
                className="wash rounded-[6px] border border-border px-3 py-1.5 text-body text-ink"
                title="The real Cambridge CELTA 5 document, unaltered, with this candidate's data filled in -- what actually gets submitted to Cambridge"
              >
                Export real CELTA 5
              </a>
            </>
          ) : (
            <>
              <span
                className="cursor-not-allowed rounded-[6px] border border-border px-3 py-1.5 text-body text-muted"
                title="All signatures below must read Signed before the booklet can be exported"
              >
                Export CELTA 5 booklet
              </span>
              <span
                className="cursor-not-allowed rounded-[6px] border border-border px-3 py-1.5 text-body text-muted"
                title="All signatures below must read Signed before the booklet can be exported"
              >
                Export real CELTA 5
              </span>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 border-b border-border-faint pb-2 last:border-none">
            <span className="text-body text-ink">{row.label}</span>
            <div className="flex items-center gap-2">
              {row.at ? <span className="text-label text-muted">{formatDateTime(row.at, timeZone)}</span> : null}
              <span className={`status-pill ${STATE_CLASS[row.state]}`}>{STATE_LABEL[row.state]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
