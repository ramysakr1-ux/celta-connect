import { Fragment } from "react";
import { LockBox } from "@/app/portfolio/[traineeId]/celta5/booklet/shell";

// The Stage Two / Stage Three criteria grid.
//
// Ramy's design renders each criterion as a row with an S+/S/N/X pill
// group rather than as Cambridge's bare tick columns. X is "Not
// Applicable" -- the candidate hasn't yet focused on that criterion at
// this stage -- and it exists in his design and in the Stage Two rubric
// but not in the printed grid, which simply leaves the cell empty. An
// empty cell and "not applicable yet" mean different things to an
// assessor, so the distinction is worth keeping.
//
// Stage Two shows two columns, You and Tutor: the candidate self-assesses
// first and the tutor's column stays locked until they submit, so the
// self-assessment is genuinely their own. Stage Three is tutor-only.

export type Mark = "S+" | "S" | "N" | "X" | null;

export type CriterionRow = {
  code: string;
  text: string;
  topic?: string; // set on the first row of a topic to print its band
  candidate?: Mark;
  tutor?: Mark;
};

const MARKS: { value: Exclude<Mark, null>; cls: string }[] = [
  { value: "S+", cls: "sp" },
  { value: "S", cls: "s" },
  { value: "N", cls: "n" },
  { value: "X", cls: "x" },
];

function PillGroup({ name, value, disabled }: { name: string; value: Mark; disabled: boolean }) {
  return (
    <div className="c5-pills">
      {MARKS.map((m) => (
        <span key={m.value}>
          <input
            type="radio"
            id={`${name}-${m.value}`}
            name={name}
            value={m.value}
            defaultChecked={value === m.value}
            disabled={disabled}
          />
          <label htmlFor={`${name}-${m.value}`} className={m.cls}>
            {m.value}
          </label>
        </span>
      ))}
    </div>
  );
}

export function CriteriaGrid({
  rows,
  showCandidateColumn,
  candidateEditable,
  tutorLocked,
  tutorLockedLabel = "Locked",
}: {
  rows: CriterionRow[];
  showCandidateColumn: boolean;
  candidateEditable: boolean;
  tutorLocked: boolean;
  tutorLockedLabel?: string;
}) {
  return (
    <table className="c5-table">
      <thead>
        <tr>
          <th style={{ width: showCandidateColumn ? "52%" : "70%" }}>Candidates can demonstrate their learning by:</th>
          {showCandidateColumn ? <th style={{ width: "24%" }}>You</th> : null}
          <th style={{ width: showCandidateColumn ? "24%" : "30%" }}>Tutor</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Fragment key={r.code}>
            {r.topic ? (
              <tr>
                <td colSpan={showCandidateColumn ? 3 : 2} style={{ fontWeight: 700, fontSize: 9.5 }}>
                  {r.topic}
                </td>
              </tr>
            ) : null}
            <tr>
              <td>
                <span style={{ fontWeight: 700, color: "oklch(38% 0.072 195)" }}>{r.code}</span> — {r.text}
              </td>
              {showCandidateColumn ? (
                <td>
                  <PillGroup name={`c-${r.code}`} value={r.candidate ?? null} disabled={!candidateEditable} />
                </td>
              ) : null}
              <td>
                {tutorLocked ? (
                  <span className="text-[10px] italic text-muted">{tutorLockedLabel}</span>
                ) : (
                  <PillGroup name={`t-${r.code}`} value={r.tutor ?? null} disabled />
                )}
              </td>
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

export function StageLocked({ children }: { children: React.ReactNode }) {
  return <LockBox>{children}</LockBox>;
}
