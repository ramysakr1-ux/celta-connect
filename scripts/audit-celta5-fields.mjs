#!/usr/bin/env node
// Traces every CELTA 5 field from where it is created to where it is
// printed, so "will everything land in the right place?" has a mechanical
// answer rather than a reassuring one.
//
// Ramy, 29 Aug 2026 -- names, course number and dates are set at course
// creation or from the application; stage comments come from tutor
// feedback and the Stage 2 tutorial transcript; and all of it has to
// survive into the PDF at close-out. This checks each hop by reading the
// source files rather than by trusting a description of them.
//
// Run: node scripts/audit-celta5-fields.mjs

import { readFileSync } from "node:fs";

const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

const REPLICA = read("src/app/api/portfolio/[traineeId]/celta5/replica/route.ts");
const PAGE = read("src/app/portfolio/[traineeId]/celta5/page.tsx");
const LEDGER = read("src/lib/celta5-signatures.ts");

// field -> { origin: who writes it, pdf: token that must appear in the
// replica route, booklet: token that must appear in the page }
const FIELDS = [
  { group: "Cover", name: "Candidate name", origin: "application form -> profiles.full_name", pdf: "traineeName: trainee.full_name" },
  { group: "Cover", name: "Centre name", origin: "centre record", pdf: "centerName:" },
  { group: "Cover", name: "Centre number", origin: "centre record", pdf: "centerNumber:" },
  { group: "Cover", name: "Course number", origin: "course creation (MCT/course admin)", pdf: "courseCode: course.course_code" },
  { group: "Cover", name: "Course dates", origin: "course creation", pdf: "courseDates:" },
  { group: "Cover", name: "Tutor names", origin: "course_tutors", pdf: "tutorNames:" },

  { group: "Attendance", name: "Course hours", origin: "courses.total_hours", pdf: "totalCourseHours: course.total_hours", booklet: "courseHours=" },
  { group: "Attendance", name: "Hours attended", origin: "trainer attendance form", pdf: "totalHoursAttended: record.hours_attended", booklet: "hoursAttended={record.hours_attended}" },
  { group: "Attendance", name: "Session missed", origin: "trainer attendance form (0249)", pdf: "sessionMissed: a.session_missed", booklet: "a.session_missed" },
  { group: "Attendance", name: "Candidate comment", origin: "trainer attendance form (0249)", pdf: "candidateComment: a.candidate_comment", booklet: "a.candidate_comment" },
  { group: "Attendance", name: "Tutor signature", origin: "trainer attendance form (0249)", pdf: "a.tutor_signature_name", booklet: "a.tutor_signature_name" },

  { group: "Observations", name: "Observation rows", origin: "trainee observation form", pdf: "observations: (observations ?? [])", booklet: "ObservationsRecord" },
  { group: "Assessed TP", name: "TP rows", origin: "tp_lessons (tutor feedback)", pdf: "assessedTp: (tpLessons ?? [])", booklet: "AssessedTpRecord" },
  { group: "Assessed TP", name: "Tutor assessment", origin: "tutor TP feedback", pdf: "tutorAssessment: l.tutor_assessment", booklet: "l.tutor_assessment" },

  { group: "Assignments", name: "Final grade", origin: "assignment marking", pdf: "finalGrade: a.final_grade" },
  { group: "Assignments", name: "Own-work signature", origin: "candidate, before submitting", pdf: "candidateSignatureName: signedName" },
  { group: "Assignments", name: "Result-seen signature", origin: "candidate, after result (0245)", pdf: "outcome_signature_name", ledger: "outcome_" },

  { group: "Stage 1", name: "Strengths", origin: "tutor, auto-drafted from tagged TP feedback", pdf: "strengths: record.stage1_strengths" },
  { group: "Stage 1", name: "Action plan", origin: "tutor, auto-drafted from tagged TP feedback", pdf: "actionPlan: record.stage1_action_plan" },
  { group: "Stage 1", name: "Tutor signature", origin: "tutor on release", pdf: "tutorSignatureName: record.stage1_tutor_signature_name", ledger: "stage1" },
  { group: "Stage 1", name: "Candidate signature", origin: "candidate after release", pdf: "candidateSignatureName: record.stage1_candidate_signature_name", ledger: "stage1" },

  { group: "Stage 2", name: "Candidate self-assessment marks", origin: "candidate, before tutorial", pdf: "candidateStage2Marks" },
  { group: "Stage 2", name: "Tutor marks", origin: "tutor", pdf: "tutorStage2Marks" },
  { group: "Stage 2", name: "Tutorial summary", origin: "tutor / Zoom transcript", pdf: "tutorNotes: record.stage2_tutor_notes" },
  { group: "Stage 2", name: "Tutor signature", origin: "tutor", pdf: "tutorSignatureName: record.stage2_tutor_signature_name", ledger: "stage2" },
  { group: "Stage 2", name: "Candidate signature", origin: "candidate", pdf: "candidateSignatureName: record.stage2_candidate_signature_name", ledger: "stage2" },

  { group: "Stage 3", name: "Tutor marks", origin: "tutor", pdf: "tutorStage3Marks" },
  { group: "Stage 3", name: "Tutor signature", origin: "tutor", pdf: "tutorSignatureName: record.stage3_tutor_signature_name", ledger: "stage3" },
  { group: "Stage 3", name: "Candidate signature", origin: "candidate", pdf: "candidateSignatureName: record.stage3_candidate_signature_name", ledger: "stage3" },

  { group: "Final day", name: "Candidate final signature", origin: "candidate on last day", pdf: "candidateSignatureName: record.final_candidate_signature_name", ledger: "final" },
  // Cambridge labels this cell "Accepted by Tutor"; the replica carries it
  // as the final declaration's tutorSignatureName.
  { group: "Final day", name: "Accepted by tutor", origin: "tutor on last day", pdf: "tutorSignatureName: record.final_tutor_signature_name" },

  { group: "Confirmations", name: "Portfolio terms", origin: "candidate, booklet section", pdf: null, booklet: "portfolio_terms_confirmed_at" },
  { group: "Confirmations", name: "Appeals procedure read", origin: "candidate, booklet section", pdf: null, booklet: "appeals_read_confirmed_at" },
];

let ok = 0, gaps = [];
let lastGroup = "";
for (const f of FIELDS) {
  if (f.group !== lastGroup) { console.log(`\n${f.group}`); lastGroup = f.group; }
  const checks = [];
  if (f.pdf === null) checks.push(["PDF", false, "no page in the replica"]);
  else if (f.pdf) checks.push(["PDF", REPLICA.includes(f.pdf), f.pdf]);
  if (f.booklet) checks.push(["screen", PAGE.includes(f.booklet), f.booklet]);
  if (f.ledger) checks.push(["ledger", LEDGER.includes(f.ledger), f.ledger]);

  const bad = checks.filter(([, pass]) => !pass);
  const mark = bad.length === 0 ? "OK  " : "GAP ";
  if (bad.length === 0) ok++; else gaps.push(`${f.group} / ${f.name}: ${bad.map(([w, , t]) => `${w} (${t})`).join(", ")}`);
  console.log(`  ${mark} ${f.name.padEnd(32)} <- ${f.origin}`);
}

console.log(`\n${ok}/${FIELDS.length} fields traced end to end.`);
if (gaps.length) {
  console.log(`\n${gaps.length} gap(s):`);
  for (const g of gaps) console.log(`  - ${g}`);
  process.exitCode = 1;
}
