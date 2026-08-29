import { Pulled } from "@/app/portfolio/[traineeId]/celta5/booklet/shell";

// The four record tables, in the column order of Ramy's design file.
//
// Two departures from the printed Cambridge form, both his and both
// deliberate: Observations carries a "Kind" column (experienced teacher /
// filmed / peer), because Connect knows which it was and an assessor
// checking the six-hour rule needs the filmed split visible; and Written
// assignments replaces Cambridge's three tick columns with a single pulled
// Result, because the result is already recorded against the assignment
// and re-entering it by hand is how paper records end up contradicting the
// system. Signature stays a candidate-typed field, as on paper.

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().slice(0, 10);
}

export function AttendanceRecord({
  courseHours,
  hoursAttended,
  unavoidable,
  other,
}: {
  courseHours: number | null;
  hoursAttended: number | null;
  unavoidable: { date: string; session: string; reason: string; madeUp: string; tutor: string }[];
  other: { date: string; session: string; reason: string; madeUp: string; candidate: string; tutor: string }[];
}) {
  const blank = (n: number, cols: number) =>
    Array.from({ length: Math.max(0, n) }, (_, i) => (
      <tr key={`b${i}`}>
        {Array.from({ length: cols }, (_, c) => (
          <td key={c} style={{ height: 26 }} />
        ))}
      </tr>
    ));

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-[11px]" style={{ marginBottom: 10 }}>
        <span className="flex items-center gap-2">
          Total number of course hours: <strong className="text-ink">{courseHours ?? "—"}</strong> <Pulled />
        </span>
        <span className="flex items-center gap-2">
          Total number of hours attended: <strong className="text-ink">{hoursAttended ?? "—"}</strong> <Pulled />
        </span>
      </div>
      <p className="text-[10px] text-muted" style={{ marginBottom: 10 }}>
        Please note that 100% attendance is expected. However, in the event of unavoidable absence such as illness,
        family bereavement or unexpected family commitment, this must be recorded (see below) and the work from the
        session missed must be made up.
      </p>
      <table className="c5-table" style={{ marginBottom: 14 }}>
        <thead>
          <tr>
            <th style={{ width: "16%" }}>Date/times of unavoidable absences</th>
            <th style={{ width: "20%" }}>Session missed</th>
            <th style={{ width: "16%" }}>Reason</th>
            <th style={{ width: "30%" }}>How work made up, e.g. discussion with tutor/tasks completed</th>
            <th style={{ width: "18%" }}>Tutor signature</th>
          </tr>
        </thead>
        <tbody>
          {unavoidable.map((r, i) => (
            <tr key={i}>
              <td>{r.date}</td>
              <td>{r.session}</td>
              <td>{r.reason}</td>
              <td>{r.madeUp}</td>
              <td>{r.tutor}</td>
            </tr>
          ))}
          {blank(4 - unavoidable.length, 5)}
        </tbody>
      </table>
      <p className="text-[10px] text-muted" style={{ marginBottom: 10 }}>
        Please note that unexplained or inappropriate absences/late arrivals will be recorded by the Course Tutor.
      </p>
      <table className="c5-table">
        <thead>
          <tr>
            <th style={{ width: "15%" }}>Date/times of other absences/late arrivals</th>
            <th style={{ width: "18%" }}>Session missed</th>
            <th style={{ width: "13%" }}>Reason</th>
            <th style={{ width: "18%" }}>Work made up</th>
            <th style={{ width: "18%" }}>Candidate comment</th>
            <th style={{ width: "18%" }}>Tutor comment/signature</th>
          </tr>
        </thead>
        <tbody>
          {other.map((r, i) => (
            <tr key={i}>
              <td>{r.date}</td>
              <td>{r.session}</td>
              <td>{r.reason}</td>
              <td>{r.madeUp}</td>
              <td>{r.candidate}</td>
              <td>{r.tutor}</td>
            </tr>
          ))}
          {blank(4 - other.length, 6)}
        </tbody>
      </table>
    </>
  );
}

export function ObservationsRecord({
  rows,
}: {
  rows: { date: string; minutes: number | null; level: string; learners: number | null; focus: string; kind: string }[];
}) {
  return (
    <>
      <p className="flex items-center gap-2 text-[10px] text-muted" style={{ marginBottom: 10 }}>
        Rows below are pulled automatically from Observations as they are logged. <Pulled />
      </p>
      <table className="c5-table">
        <thead>
          <tr>
            <th style={{ width: "14%" }}>Date</th>
            <th style={{ width: "14%" }}>Lesson length (minutes)</th>
            <th style={{ width: "16%" }}>Level of class</th>
            <th style={{ width: "14%" }}>No. of learners present</th>
            <th style={{ width: "24%" }}>Lesson focus</th>
            <th style={{ width: "18%" }}>Kind</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-[10px] italic text-muted">
                No observations logged yet.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                <td>{fmtDate(r.date)}</td>
                <td>{r.minutes ?? ""}</td>
                <td>{r.level}</td>
                <td>{r.learners ?? ""}</td>
                <td>{r.focus}</td>
                <td>{r.kind}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}

export function AssessedTpRecord({
  rows,
}: {
  rows: { date: string; length: string; level: string; learners: string; focus: string; assessment: string; initials: string }[];
}) {
  return (
    <>
      <p className="flex items-center gap-2 text-[10px] text-muted" style={{ marginBottom: 10 }}>
        Rows below are pulled automatically from each TP Record as tutor feedback is submitted. <Pulled />
      </p>
      <table className="c5-table">
        <thead>
          <tr>
            <th style={{ width: "13%" }}>Date</th>
            <th style={{ width: "10%" }}>Length</th>
            <th style={{ width: "14%" }}>Level</th>
            <th style={{ width: "11%" }}>No. of learners</th>
            <th style={{ width: "24%" }}>Lesson focus</th>
            <th style={{ width: "17%" }}>Tutor assessment *</th>
            <th style={{ width: "11%" }}>Tutor initials</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-[10px] italic text-muted">
                No assessed teaching practice recorded yet.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                <td>{fmtDate(r.date)}</td>
                <td>{r.length}</td>
                <td>{r.level}</td>
                <td>{r.learners}</td>
                <td>{r.focus}</td>
                <td>{r.assessment}</td>
                <td>{r.initials}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="text-[10px] text-muted" style={{ marginTop: 8 }}>
        * Candidates are reminded that tutor assessments relate to the standard of the lesson for that stage of the
        course, and do not represent a final assessment or grade.
      </p>
    </>
  );
}
