"use client";

import { useState } from "react";
import { OBSERVATION_HOURS_REQUIRED } from "@/lib/observation-hours";
import { useCentreTimeZone } from "@/components/centre-time-zone";
import { formatDate } from "@/lib/format-date";

export interface ObservationLogEntry {
  id: string;
  kind: "live" | "filmed" | "peer";
  date: string | null;
  lengthMinutes: number | null;
  level: string | null;
  learnerCount: number | null;
  focus: string | null;
  mode: "f2f" | "online" | null;
  source: string;
}

export interface CandidateObservationRow {
  id: string;
  name: string;
  liveHours: number;
  filmedHours: number;
  hoursCounted: number;
  onTrack: boolean;
  peerCount: number;
  pendingTasks: number;
  log: ObservationLogEntry[];
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "live", label: "Experienced teacher" },
  { value: "filmed", label: "Filmed" },
  { value: "peer", label: "Peer" },
] as const;

const KIND_LABEL: Record<ObservationLogEntry["kind"], string> = { live: "Live", filmed: "Filmed", peer: "Peer" };
const KIND_CLASS: Record<ObservationLogEntry["kind"], string> = {
  live: "border-status-on-track-text text-status-on-track-text",
  filmed: "border-primary text-primary",
  peer: "border-muted text-muted",
};

export function ObservationHoursRoster({ rows, obsTasksTotal }: { rows: CandidateObservationRow[]; obsTasksTotal: number }) {
  const timeZone = useCentreTimeZone();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3 py-1.5 text-label font-semibold ${
              filter === f.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:border-primary/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="sheet text-body text-muted">No candidates on this course.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const filteredLog = filter === "all" ? row.log : row.log.filter((e) => e.kind === filter);
            return (
              <details key={row.id} className="sheet">
                <summary className="grid cursor-pointer grid-cols-2 items-center gap-3 sm:grid-cols-6">
                  <span className="text-body font-semibold text-ink sm:col-span-2">{row.name}</span>
                  <span className="text-body text-muted">
                    <span className="text-ink">{row.liveHours.toFixed(1)}h</span> experienced
                  </span>
                  <span className="text-body text-muted">
                    <span className="text-ink">{row.filmedHours.toFixed(1)}h</span> filmed
                  </span>
                  <span className="text-body text-muted">
                    <span className="text-ink">{row.peerCount}</span> peer
                  </span>
                  <span className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className={`pill ${row.onTrack ? "pill-success" : "pill-warning"}`}>
                      {row.onTrack ? "On track" : `${row.hoursCounted.toFixed(1)} / ${OBSERVATION_HOURS_REQUIRED}h`}
                    </span>
                  </span>
                </summary>

                {row.pendingTasks > 0 ? (
                  <p className="mt-2 text-label text-status-warning-text">
                    {row.pendingTasks} of {obsTasksTotal} directed observation task{obsTasksTotal === 1 ? "" : "s"} still
                    pending.
                  </p>
                ) : null}

                <div className="mt-3 flex flex-col divide-y divide-border-faint border-t border-border-faint">
                  {filteredLog.length === 0 ? (
                    <p className="py-3 text-body text-muted first:pt-3">Nothing logged in this category yet.</p>
                  ) : (
                    filteredLog.map((entry) => (
                      <div key={entry.id} className="flex flex-col gap-1 py-3 text-body first:pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-micro font-semibold uppercase tracking-wide ${KIND_CLASS[entry.kind]}`}>
                            {KIND_LABEL[entry.kind]}
                          </span>
                          {entry.date ? <span className="text-label text-muted">{formatDate(entry.date, timeZone)}</span> : null}
                          {entry.lengthMinutes ? <span className="text-label text-muted">{entry.lengthMinutes} min</span> : null}
                          {entry.level ? <span className="text-label text-muted">{entry.level}</span> : null}
                          {entry.learnerCount != null ? <span className="text-label text-muted">{entry.learnerCount} learners</span> : null}
                          {entry.mode ? <span className="text-label text-muted">{entry.mode === "f2f" ? "Face to face" : "Online"}</span> : null}
                        </div>
                        {entry.focus ? <p className="text-body text-ink">{entry.focus}</p> : null}
                        <p className="text-label text-muted">{entry.source}</p>
                      </div>
                    ))
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
