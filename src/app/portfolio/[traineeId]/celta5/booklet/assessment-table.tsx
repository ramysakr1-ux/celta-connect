// Table 1 -- Assessment of CELTA Syllabus Topics.
//
// Printed in the CELTA 5's "Candidate guide to assessment" and missing from
// the app's own copy of that section, which had the surrounding prose but
// not the table. It is the only place a candidate can see which assignment
// carries which topic, so a guide without it answers a different question
// than the one Cambridge prints it to answer. Written assignment titles are
// in italics in the booklet; kept italic here for the same reason.

const ROWS: { topic: string; title: string; main: string[]; secondary: string[] }[] = [
  {
    topic: "Topic 1",
    title: "Learners and teachers and the teaching and learning context",
    main: ["Focus on the learner", "Lesson planning and teaching"],
    secondary: ["Language related tasks", "Skills assignment", "Lessons from the classroom"],
  },
  {
    topic: "Topic 2",
    title: "Language analysis and awareness",
    main: ["Language related tasks", "Lesson planning and teaching"],
    secondary: ["Focus on the learner", "Lesson evaluations"],
  },
  {
    topic: "Topic 3",
    title: "Language skills: reading, listening, speaking and writing",
    main: ["Skills assignment", "Lesson planning and teaching"],
    secondary: ["Focus on the learner", "Lesson evaluations"],
  },
  {
    topic: "Topic 4",
    title: "Planning and resources for different teaching contexts",
    main: ["Lessons from the classroom", "Lesson planning and teaching", "Lesson evaluations"],
    secondary: ["Language related tasks", "Skills assignment", "Focus on the learner"],
  },
  {
    topic: "Topic 5",
    title: "Developing teaching skills and professionalism",
    main: ["Lessons from the classroom", "Lesson planning and teaching", "Lesson evaluations"],
    secondary: ["Focus on the learner", "Skills assignment", "Language related tasks"],
  },
];

// The four written assignments are the italicised titles in Cambridge's own
// table; everything else in those cells is teaching practice.
const ASSIGNMENT_TITLES = new Set([
  "Focus on the learner",
  "Language related tasks",
  "Skills assignment",
  "Lessons from the classroom",
]);

function Cell({ items }: { items: string[] }) {
  return (
    <>
      {items.map((t, i) => (
        <span key={t}>
          {i > 0 ? "; " : ""}
          {ASSIGNMENT_TITLES.has(t) ? <em>{t}</em> : t}
        </span>
      ))}
    </>
  );
}

export function AssessmentTopicsTable() {
  return (
    <>
      <p className="text-[11px] font-bold text-ink" style={{ margin: "14px 0 6px" }}>
        Table 1 &ndash; Assessment of CELTA Syllabus Topics
      </p>
      <p className="text-[10px] text-muted" style={{ marginBottom: 8 }}>
        Written assignment titles are in italics.
      </p>
      <table className="c5-table">
        <thead>
          <tr>
            <th style={{ width: "10%" }}>Topic</th>
            <th style={{ width: "26%" }}>Title</th>
            <th style={{ width: "32%" }}>Assessment (main)</th>
            <th style={{ width: "32%" }}>Assessment (secondary source)</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.topic}>
              <td>{r.topic}</td>
              <td>{r.title}</td>
              <td>
                <Cell items={r.main} />
              </td>
              <td>
                <Cell items={r.secondary} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
