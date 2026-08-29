import { Pulled } from "@/app/portfolio/[traineeId]/celta5/booklet/shell";

// Record of written assignments.
//
// Cambridge prints three tick columns -- Pass 1st submission, Pass 2nd
// submission, Fail -- for the candidate to fill in by hand. Ramy's design
// replaces them with a single pulled Result, because the result is already
// recorded against the assignment and re-entering it by hand is how a
// paper record ends up contradicting the system it was copied from. The
// candidate signature stays a typed field, exactly as on paper: Cambridge
// asks the candidate to confirm the work is their own, and that is the
// candidate's act, not the system's.

export type AssignmentRow = {
  title: string;
  result: string;
  signatureName: string | null;
  signedAt: string | null;
};

export function WrittenAssignmentsRecord({ rows }: { rows: AssignmentRow[] }) {
  return (
    <>
      <p className="text-[10px] leading-relaxed text-muted" style={{ marginBottom: 8 }}>
        During the course, you are required to produce four assignments for assessment purposes. These are practical in
        nature and help to synthesise principles and practice from your teaching and learning on the course. You need to
        read the rubrics carefully, and address the questions set. Please note that two assignments can be conflated at
        the discretion of the centre, in which case both sections of the assignment will receive separate grades.
      </p>
      <p className="text-[10px] leading-relaxed text-muted" style={{ marginBottom: 8 }}>
        You will be given written feedback on each assignment, and a grade (Pass or Fail). Written assignments are
        marked for their content and their standard of English and you must pass in both areas to be awarded an overall
        pass for the assignment. If you are given a printed format for an assignment, please use it. A minimum of two of
        the assignments must be written in suitably formal, continuous prose. Written work can be handwritten (provided
        that it can be read easily) or typed. You will be required to confirm that the written work is your own.
      </p>
      <p className="text-[10px] leading-relaxed text-muted" style={{ marginBottom: 8 }}>
        In the event that any piece of work is considered unsatisfactory, you will have one opportunity to resubmit
        that piece of work during the course. If still unsatisfactory after resubmission, it will be graded as Fail.
      </p>
      <p className="text-[10px] leading-relaxed text-muted" style={{ marginBottom: 12 }}>
        It is possible to fail one written assignment and still pass the course, provided that you have demonstrated
        elsewhere in your coursework that you have met the criteria on which that assignment focused. However, if you
        fail one assignment, it is not possible to be awarded a Pass &lsquo;A&rsquo; for a final course grade. If you
        fail two written assignments, you cannot be awarded a Pass grade at the end of the course.
      </p>
      <table className="c5-table">
        <thead>
          <tr>
            <th style={{ width: "34%" }}>Title</th>
            <th style={{ width: "28%" }}>Result</th>
            <th style={{ width: "38%" }}>Candidate signature — I confirm that this is my own work</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.title}>
              <td>{r.title}</td>
              <td>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span>{r.result}</span>
                  <Pulled />
                </span>
              </td>
              <td>
                {r.signatureName ? (
                  <span className="text-ink">
                    {r.signatureName}
                    {r.signedAt ? (
                      <span className="text-muted">
                        {" · "}
                        {new Date(r.signedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-[10px] italic text-muted">Not yet signed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-muted" style={{ marginTop: 8 }}>
        Please note that severe penalties are applied if plagiarised work is detected. These will range from loss of
        marks to disqualification and a ban on re-entry for a period of up to three years.
      </p>
    </>
  );
}
