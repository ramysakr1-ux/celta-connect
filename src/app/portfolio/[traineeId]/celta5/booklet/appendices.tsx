import { CELTA_CRITERIA_SECTIONS, CRITERIA_LABELS, CRITERIA_GUIDANCE, GRADE_DESCRIPTORS } from "@/lib/celta-criteria";

// Appendix 1 -- "Notes to help you prepare for tutorials: the following are
// examples of what you need to do to show that you have achieved the
// assessment criteria." Cambridge prints the criteria with sub-bullets
// beneath each; both already exist in the app as the real booklet-verified
// set (41 codes, no 3c), so the appendix renders from the same source the
// grids do rather than from a second copy that could drift.

export function Appendix1() {
  return (
    <>
      <p className="text-[10px] leading-relaxed text-muted" style={{ marginBottom: 12 }}>
        Notes to help you prepare for tutorials: the following are examples of what you need to do to show that you
        have achieved the assessment criteria.
      </p>
      {CELTA_CRITERIA_SECTIONS.map((sec) => (
        <div key={sec.section} style={{ marginBottom: 16 }}>
          <p className="text-[10px] font-bold text-ink" style={{ marginBottom: 6 }}>
            TOPIC {sec.section} – {sec.title.toUpperCase()}
          </p>
          {sec.codes.map((code) => (
            <div key={code} style={{ marginBottom: 8 }}>
              <p className="text-[10.5px] text-ink">
                <span style={{ fontWeight: 700 }}>{code}</span> {CRITERIA_LABELS[code] ?? ""}
              </p>
              {(CRITERIA_GUIDANCE[code] ?? []).length > 0 ? (
                <ul className="ml-4 list-disc" style={{ marginTop: 2 }}>
                  {(CRITERIA_GUIDANCE[code] ?? []).map((g, i) => (
                    <li key={i} className="text-[10px] leading-relaxed text-muted">
                      {g}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// Appendix 2 -- the performance descriptors, used at the END of the course
// to determine final recommended grades. A candidate's performance must
// match ALL descriptors at a grade to achieve it, which is why this is
// printed as a comparison across the three passing grades rather than as a
// list. Fail is included: the booklet prints it, and omitting it would
// make the table read as though only passes exist.
export function Appendix2() {
  return (
    <>
      <p className="text-[10px] leading-relaxed text-muted" style={{ marginBottom: 6 }}>
        The CELTA performance descriptors are for use at the end of the course to determine final recommended grades.
      </p>
      <p className="text-[10px] leading-relaxed text-muted" style={{ marginBottom: 12 }}>
        By the end of the course, candidates&rsquo; performance must match ALL of the descriptors at a particular
        passing grade in order to achieve that grade.
      </p>
      <table className="c5-table">
        <thead>
          <tr>
            <th style={{ width: "16%" }} />
            <th style={{ width: "28%" }}>Pass</th>
            <th style={{ width: "28%" }}>Pass B</th>
            <th style={{ width: "28%" }}>Pass A</th>
          </tr>
        </thead>
        <tbody>
          {GRADE_DESCRIPTORS.dimensions.map((d) => (
            <tr key={d.name}>
              <td style={{ fontWeight: 700 }}>{d.name}</td>
              <td>{d.Pass}</td>
              <td>{d["Pass B"]}</td>
              <td>{d["Pass A"]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
