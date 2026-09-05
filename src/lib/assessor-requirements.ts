// Ramy, 30 Aug 2026: "those numbers that are hard to [remember]. Let's get
// them down somewhere. Maybe the assessor pack will contain them."
//
// The Administration Handbook (June 2025) fixes what an assessor must do on a
// visit, and the counts are easy to misremember -- I had to look them up, and
// the one number people half-remember as scaling with course size (three /
// four / five) is the DOUBLE-MARKING table in section 9.2.3, page 27, which
// is the centre's job and a different mechanism entirely. (This comment said
// "section 11" until 1 Sep 2026, checked against the PDF itself: section 11
// is Candidate assessment. The table reads "Up to nine candidates: three of
// each assignment... 10-16: four... 17-24: five", and the sample must include
// any fail assignments.) So both live here, derived
// against the real course rather than printed as a static list, and each
// carries the section it comes from so nobody has to take this file's word
// for it.
//
// Everything here is quotation or arithmetic on a quotation. If a number in
// this file cannot be traced to a `cite` below, it does not belong here.

export interface AssessorRequirement {
  /** Short imperative -- what the assessor does. */
  label: string;
  /** This course's own numbers, where the requirement has any. */
  detail: string;
  /** Handbook section, shown so the claim is checkable. */
  cite: string;
  /** Something about this course means the requirement bites harder. */
  emphasis?: string;
}

export type AssessmentKind = "regular" | "two_yearly";

export interface AssessorRequirementInput {
  assessmentKind: AssessmentKind;
  candidateCount: number;
  /** Candidates provisionally graded Fail, or on a Pass/Fail borderline. */
  atRiskCount: number;
  /** Candidates the centre has flagged for this visit. */
  selectedCount: number;
  withdrawnCount: number;
  /**
   * Candidates who have asked to speak with the assessor. A count only --
   * the names are deliberately not carried anywhere near this file, and the
   * meeting is private in both directions.
   */
  meetingRequestCount?: number;
}

export function buildAssessorRequirements(input: AssessorRequirementInput): AssessorRequirement[] {
  const { assessmentKind, candidateCount, atRiskCount, selectedCount, withdrawnCount, meetingRequestCount = 0 } = input;
  const twoYearly = assessmentKind === "two_yearly";

  const requirements: AssessorRequirement[] = [
    {
      label: "Co-observe two candidates",
      detail: "One and a half hours or more of teaching practice, whatever the size of the course.",
      cite: "14.2",
    },
    {
      label: "Observe tutor feedback",
      detail:
        "After the lesson, agree the standard and the feedback with the tutor away from the candidates, then observe the feedback itself. If feedback is delayed, observe it from an earlier session.",
      cite: "14.2",
    },
    {
      label: twoYearly ? "Read a minimum of four portfolios" : "Read two portfolios in full",
      detail: twoYearly
        ? `A minimum of four of the ${candidateCount} portfolios on this course, plus every portfolio provisionally graded Fail or potential Fail.`
        : `Two of the ${candidateCount} portfolios on this course, read in full. Where more than two candidates are Fail, focus on the borderline cases.`,
      cite: twoYearly ? "14.2" : "14.2 / 15.1",
      emphasis:
        twoYearly && atRiskCount > 0
          ? `${atRiskCount} candidate${atRiskCount === 1 ? " is" : "s are"} Fail or potential Fail, so ${atRiskCount === 1 ? "that portfolio" : "those portfolios"} must be read on top of the four.`
          : !twoYearly && atRiskCount > 2
            ? `${atRiskCount} candidates are Fail or potential Fail — more than two, so the two you read should be the borderline cases.`
            : undefined,
    },
    {
      label: "Read the portfolio of someone you watched teach",
      detail:
        "At least one of the two candidates observed doing teaching practice, unless the number of Pass/Fail candidates makes that impossible.",
      cite: "14.2",
    },
    {
      label: "Hold the grading meeting with all tutors",
      detail:
        "Provisional grades and the work still needed for a final recommended grade. If not every tutor can attend, the decisions must still be agreed by all of them.",
      cite: "14.3",
    },
    {
      label: "Meet the candidates without tutors present",
      detail: "The assessor is introduced to the candidates, and there is an opportunity for discussion with no tutors in the room.",
      cite: "14.2",
      emphasis:
        meetingRequestCount > 0
          ? `${meetingRequestCount} candidate${meetingRequestCount === 1 ? " has" : "s have"} asked to speak with you. Names are not shown before the meeting.`
          : undefined,
    },
  ];

  if (withdrawnCount > 0) {
    requirements.push({
      label: "Check the withdrawn candidates' documentation",
      detail: `${withdrawnCount} candidate${withdrawnCount === 1 ? " has" : "s have"} withdrawn. Check the withdrawal letter, and their application.`,
      cite: "14.2 / 14.1",
    });
  }

  requirements.push({
    label: "Check any action plan agreed with Cambridge",
    detail: "Where one is in place, check that the measures are actually being adopted.",
    cite: "14.2",
  });

  if (selectedCount > 0 && selectedCount < candidateCount) {
    requirements.push({
      label: "Selection of candidates is yours, with the centre",
      detail: `The centre has put ${selectedCount} of ${candidateCount} forward. It is not normally possible to examine the entire contents of every portfolio, and the choice is the assessor's in consultation with the centre.`,
      cite: "15.1",
    });
  }

  return requirements;
}

/**
 * Handbook 11: how many of each written assignment the CENTRE must
 * double-mark. Scales with cohort size, which is the number people tend to
 * confuse with the assessment requirements above. The assessor doesn't do
 * this -- but "course assessors may ask to see this record", so the pack is
 * the right place for the centre to be reminded what its own number is.
 */
export function doubleMarkingPerAssignment(candidateCount: number): number | null {
  if (candidateCount <= 0) return null;
  if (candidateCount <= 9) return 3;
  if (candidateCount <= 16) return 4;
  if (candidateCount <= 24) return 5;
  // The table stops at 24; above that the Handbook gives no figure, so
  // neither do we rather than extrapolating a rule Cambridge didn't write.
  return null;
}


// ---------------------------------------------------------------------------
// The centre's side of the same visit.
//
// Ramy, 30 Aug 2026: "there should be somewhere where the MCT is preparing the
// assessor pack... they should just be suggested by Connect depending on the
// course size... Assessor pack requirement depending on the course mode and
// the course size."
//
// Handbook 14.1 lists what the centre must make available, "ideally 2 or more
// days before the assessment so that the assessor can read it". Three items
// on that list are conditional -- on the course's delivery mode, on whether
// the visit is the two-yearly one, and on whether anyone has withdrawn -- so
// the list is built rather than printed.

export type DeliveryMode = "f2f" | "online" | "mixed" | string;

export interface CentrePreparationItem {
  label: string;
  detail: string;
  cite: string;
  /** Present only because of this course's mode, size or circumstances. */
  conditional?: boolean;
}

export function buildCentrePreparationList(input: {
  assessmentKind: AssessmentKind;
  deliveryMode: DeliveryMode;
  candidateCount: number;
  withdrawnCount: number;
}): CentrePreparationItem[] {
  const { assessmentKind, deliveryMode, candidateCount, withdrawnCount } = input;
  const modeWord = deliveryMode === "online" ? "online" : deliveryMode === "mixed" ? "mixed mode" : "face-to-face";

  const items: CentrePreparationItem[] = [
    {
      label: "Candidate portfolios",
      detail: `All ${candidateCount}, clearly named, containing Sections A, B and C. Checked by candidates and tutors so that all assessed work is in and all records are completed and signed.`,
      cite: "14.1 / 12.1.1",
    },
    {
      label: "Assessment timetable",
      detail:
        "Enough time for the assessor to read a cross-section of portfolios, observe teaching practice, observe tutor feedback and meet the candidates -- and not too spread out.",
      cite: "14.1",
    },
    { label: "Candidate descriptions", detail: "One per candidate, with photos if possible. Candidates must be told this is shared.", cite: "14.1" },
    {
      label: "Application task",
      detail:
        withdrawnCount > 0
          ? `Completed selection tasks and interview notes for accepted AND rejected applicants -- including the ${withdrawnCount} who withdrew, whose applications the assessor also checks. Names only; no other identifying information.`
          : "Completed selection tasks and interview notes for accepted AND rejected applicants. Names only; no other identifying information.",
      cite: "14.1 / 12.2",
      conditional: withdrawnCount > 0,
    },
    { label: "Candidate agreements", detail: "The version current for these candidates, not an older one.", cite: "14.1" },
    { label: "Course timetable", detail: "The whole course.", cite: "14.1" },
    { label: "Teaching practice schedule", detail: "The TP arrangements for the time of the assessment specifically -- a separate document from the course timetable.", cite: "14.1" },
    { label: "Written assignment titles", detail: "All four.", cite: "14.1" },
    {
      label: "Sample end-of-course report",
      detail: `Showing details relevant to this course's mode -- ${modeWord}.`,
      cite: "14.1",
      conditional: true,
    },
    { label: "Attendance registers", detail: "For the language students attending teaching practice. Student names only, nothing else.", cite: "14.1" },
    {
      label: "Lesson plans for the day",
      detail: "For everyone teaching on the assessment day. If not ready in advance, handed over at the start of the lesson.",
      cite: "14.1",
    },
    { label: "The previous assessor's report", detail: "From the centre's most recent visit.", cite: "14.1" },
    {
      // Not a document, but 14.1 puts it on the same 2-3 day deadline as the
      // documents, and it is the only item on that list that blocks the
      // assessor outright: 15.2 says they cannot open their report without
      // it. A centre that forgets it has stopped the assessment without
      // knowing, which is exactly the failure a checklist is for.
      label: "Appian course notification reference",
      detail:
        "Given to the assessor, not just recorded. Without it they cannot open their Assessor Report at all. Set it on the Assessor card and it appears on their landing page for them to copy.",
      cite: "14.1 / 15.2",
    },
    { label: "Any action plan agreed with Cambridge", detail: "A copy, where one is in place -- the assessor checks the measures are being adopted.", cite: "14.1 / 14.2" },
  ];

  if (withdrawnCount > 0) {
    items.push({
      label: "Withdrawal documentation",
      detail: `${withdrawnCount} candidate${withdrawnCount === 1 ? " has" : "s have"} withdrawn. The letter confirming withdrawal is checked at the assessment.`,
      cite: "14.2",
      conditional: true,
    });
  }

  if (assessmentKind === "two_yearly") {
    items.push({
      label: "Map and accommodation details",
      detail: "For the two-yearly visit, where the assessor does not live locally. The centre normally books the accommodation and sends the details in advance.",
      cite: "14.1 / 15.3",
      conditional: true,
    });
  }

  return items;
}

/**
 * Handbook 14.1's own deadline: "2-3 days before the assessment, the centre
 * must confirm arrangements and agree a final timetable with the assessor,
 * complete the centre grade form in Appian, and give the assessor the course
 * notification reference number." Documentation should be available "ideally
 * 2 or more days before the assessment".
 *
 * Returned as a date rather than prose so the MCT sees a day, not a rule.
 */
export function centrePreparationDeadline(visitDateIso: string | null): string | null {
  if (!visitDateIso) return null;
  const [y, m, d] = visitDateIso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 3);
  return dt.toISOString().slice(0, 10);
}
