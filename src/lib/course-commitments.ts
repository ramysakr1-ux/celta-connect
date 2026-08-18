// Course Commitments.dc.html: "the hours, the length and the working advice
// in section 1 fill from the course itself." Course shape (five-week
// full-time / four-week full-time / part-time) isn't stored as its own
// field anywhere -- the timetable-generation form's "shape" choice
// (standard/part_time) is a one-time input, not persisted on the course
// row. Approximated here from the course's own start/end span, the one
// thing every course reliably has before a timetable might even exist yet.
// Boundaries: <=32 calendar days reads as the compressed four-week version,
// <=49 as the standard five-week version (Fridays off), anything longer as
// part-time. A course whose real dates don't fit this pattern will show
// the nearest-fitting section 1 text rather than nothing -- flagged here,
// not silently assumed correct.
export type CourseCommitmentsMode = "five_week" | "four_week" | "part_time";

export function inferCourseCommitmentsMode(startDate: string, endDate: string): CourseCommitmentsMode {
  const days = Math.round((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000);
  if (days <= 32) return "four_week";
  if (days <= 49) return "five_week";
  return "part_time";
}

interface ModeCopy {
  pattern: string;
  evening: string;
  adviceLead: string;
  adviceRest: string;
}

const MODE_COPY: Record<CourseCommitmentsMode, ModeCopy> = {
  five_week: {
    pattern: "Timetabled hours are 09:00 to 17:00, Monday to Thursday, for five weeks.",
    evening:
      "Beyond that, expect three to four hours most evenings for lesson planning, materials and assignments, and a substantial part of most weekends. Fridays are not a day off in practice -- they are when most people write.",
    adviceLead: "We strongly advise against working during the course",
    adviceRest:
      ", including part-time and evening work. Candidates who try it are the ones who fall behind on assignments first. If your circumstances make that impossible, speak to us before you apply -- a part-time course may suit you better, and we would rather move you than watch you struggle.",
  },
  four_week: {
    pattern: "Timetabled hours are 09:00 to 17:00, Monday to Friday, for four weeks.",
    evening:
      "Beyond that, expect three to four hours every evening for lesson planning, materials and assignments, and most of both weekend days. This is the most compressed version of the course: the same 120 hours and the same four assignments in a fortnight less than some centres allow.",
    adviceLead: "You cannot work during this course",
    adviceRest:
      ", including part-time and evening work. Candidates who try it are the ones who fall behind on assignments first. If your circumstances make that impossible, speak to us before you apply -- the five-week or part-time course would suit you better, and we would rather move you than watch you struggle.",
  },
  part_time: {
    pattern: "Timetabled sessions are Saturdays 09:00 to 17:00 and Wednesday evenings 17:30 to 21:30, for twelve weeks.",
    evening:
      "Beyond that, expect six to eight hours across the rest of each week for lesson planning, materials and assignments. The course is spread out, not lighter -- it is the same 120 hours and the same assessment.",
    adviceLead: "This course is designed to be taken alongside work",
    adviceRest:
      ", but it is not a light commitment. Two evenings and a Saturday disappear for three months, and candidates who also take on extra hours at work are the ones who fall behind on assignments. Tell us if your hours are likely to change.",
  },
};

export interface CourseCommitmentsSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface CourseCommitmentsDocument {
  title: string;
  intro: string;
  sections: CourseCommitmentsSection[];
}

// Assembles the full six-section document as plain structured text/data --
// used both for the apply-page display and for the snapshot stored at
// acceptance (via toPlainText below).
export function buildCourseCommitments(mode: CourseCommitmentsMode): CourseCommitmentsDocument {
  const m = MODE_COPY[mode];
  return {
    title: "What the course asks of you",
    intro:
      "CELTA is short, intensive and assessed throughout. Most people who struggle are not short of ability -- they are short of time, or they arrived expecting something gentler. This document says plainly what the course involves, so you can decide before you apply rather than in the second week.",
    sections: [
      {
        heading: "1 · Your time",
        paragraphs: [
          m.pattern,
          m.evening,
          `${m.adviceLead}${m.adviceRest}`,
          "Full attendance is a Cambridge requirement, not a centre preference. Absence is recorded, and missing teaching practice or input sessions can put your certificate at risk. If you are ill, tell us the same day.",
        ],
      },
      {
        heading: "2 · Being observed, and being given feedback",
        paragraphs: [
          "You will teach real learners from the first week, watched by a tutor and by the other candidates in your group. Afterwards you will receive feedback in front of that group, and you will hear your peers receive theirs.",
          "This is uncomfortable at first for almost everybody, and it is how the course works. Feedback is about the lesson, never about you as a person. We ask you to receive it in that spirit, and to give the same courtesy when you are watching someone else teach.",
        ],
      },
      {
        heading: "3 · What you need",
        paragraphs: [
          "A laptop. Assignments, lesson plans and materials cannot realistically be produced on a phone. If you do not have one, tell us at application and we will tell you what the centre can lend.",
          "A reliable internet connection, if any part of your course is taught or observed online. Teaching a lesson on a connection that drops is assessed as the lesson it became, not the lesson you planned. Test it before the course starts, and tell us early if it is a risk.",
        ],
      },
      {
        heading: "4 · How we treat each other",
        paragraphs: [
          "You will spend the course with a small group of people, and you will teach learners who have volunteered their time. We expect everyone at the centre -- candidates, tutors and staff alike -- to work to the same standard of conduct.",
        ],
        list: [
          "Respect for people. No discrimination or harassment on grounds of race, nationality, religion, sex, gender identity, sexual orientation, age or disability -- in the classroom, in materials you write, or in conversation around the course.",
          "Care with your learners. The people in your teaching practice classes are volunteers. They are not there to be experimented on, recorded without consent, or discussed by name outside the course.",
          "Honest work. Assignments must be your own. Working together on ideas is encouraged; submitting shared text is not. Sources are acknowledged, including anything generated by AI.",
          "Punctuality and reliability. A lesson plan that arrives late, or a candidate who does not, affects the people teaching alongside you.",
          "Confidentiality. Feedback given to a peer, and anything shared about a learner, stays inside the course.",
        ],
      },
      {
        heading: "5 · What we owe you in return",
        paragraphs: [
          "Tutors qualified and approved by Cambridge. Written feedback on every assessed lesson. A minimum of two progress reports, telling you honestly how you are doing -- more if you need them, and you will never reach the final week and be surprised. Clear deadlines set at the start. A named person to raise a concern with, and a complaints procedure that does not run through the tutors teaching you.",
        ],
      },
      {
        heading: "6 · Acceptance",
        paragraphs: [
          "By submitting your application you confirm that you have read this document, that you understand what the course asks of you, and that you accept the standards of conduct set out in section 4. You accept it once, at application. There is nothing further to sign.",
        ],
      },
    ],
  };
}

export function courseCommitmentsToPlainText(doc: CourseCommitmentsDocument): string {
  const parts = [doc.title, "", doc.intro];
  for (const section of doc.sections) {
    parts.push("", section.heading);
    for (const para of section.paragraphs) parts.push(para);
    if (section.list) for (const item of section.list) parts.push(`- ${item}`);
  }
  return parts.join("\n");
}
