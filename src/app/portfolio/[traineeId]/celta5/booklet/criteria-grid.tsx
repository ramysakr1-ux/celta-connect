import { Fragment } from "react";
import { LockBox } from "@/app/portfolio/[traineeId]/celta5/booklet/shell";

// The Stage Two / Stage Three criteria grid.
//
// Ramy's design renders each criterion as a row with a pill group rather
// than as Cambridge's bare tick columns.
//
// The scales differ by stage, and the difference is Cambridge's own.
// Stage Two has FOUR options -- CELTA 5 p.14 prints them: "'S+' for
// 'Above the Standard'... 'S' for 'Meets the Standard'... 'N' for 'Not to
// Standard'... 'X' for 'Not Applicable' at this stage in the course
// because you have not yet focused on teaching or planning skills
// associated with that criterion." Stage Three (p.20) lists only three,
// S+/S/N: by the final third of the course "not applicable" no longer
// applies, so there is nothing for X to mean.
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

const ALL_MARKS: { value: Exclude<Mark, null>; cls: string }[] = [
  { value: "S+", cls: "sp" },
  { value: "S", cls: "s" },
  { value: "N", cls: "n" },
  { value: "X", cls: "x" },
];

// Stage Three offers three, not four: p.20 lists only S+/S/N, because by
// the final third of the course "not yet focused on that criterion" is no
// longer an available answer.
const STAGE3_MARKS = ALL_MARKS.filter((m) => m.value !== "X");

function PillGroup({
  name,
  value,
  disabled,
  marks,
}: {
  name: string;
  value: Mark;
  disabled: boolean;
  marks: typeof ALL_MARKS;
}) {
  return (
    <div className="c5-pills">
      {marks.map((m) => (
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
  stage,
}: {
  rows: CriterionRow[];
  showCandidateColumn: boolean;
  candidateEditable: boolean;
  tutorLocked: boolean;
  tutorLockedLabel?: string;
  stage: "stage2" | "stage3";
}) {
  const marks = stage === "stage3" ? STAGE3_MARKS : ALL_MARKS;
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
                  <PillGroup name={`c-${r.code}`} value={r.candidate ?? null} disabled={!candidateEditable} marks={marks} />
                </td>
              ) : null}
              <td>
                {tutorLocked ? (
                  <span className="text-[10px] italic text-muted">{tutorLockedLabel}</span>
                ) : (
                  <PillGroup name={`t-${r.code}`} value={r.tutor ?? null} disabled marks={marks} />
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
