import "server-only";
import { authEmailShell, p } from "@/lib/email-layout";

// Email #18, "Assessor visit pack" (design_handoff_all_emails,
// full-email-specs.md). Copy is exact product copy from the spec, not
// paraphrased -- only the facts are filled in. for-claude-code-signin-
// and-email-branding.md: this is the "assessor link" email named in that
// spec's shared-shell list, so it moved off emailShell()'s spine system
// onto authEmailShell()'s centre-branded header, same as sign-in link,
// tutor invite, and password reset.
export function buildAssessorInviteEmailHtml(input: {
  centerName: string;
  courseName: string;
  visitDateLabel: string | null;
  totalCandidates: number;
  potentialFails: number;
  accessEndsLabel: string;
  packUrl: string;
}): string {
  const portfoliosValue =
    input.potentialFails > 0
      ? `${input.totalCandidates} -- including ${input.potentialFails} potential fail${input.potentialFails === 1 ? "" : "s"}`
      : `${input.totalCandidates}`;

  return authEmailShell({
    centerName: input.centerName,
    heading: "Your assessment pack is ready",
    body:
      p(
        `The pack for ${input.courseName} at ${input.centerName} is prepared and read-only: portfolios, the timetable, teaching practice arrangements for the day, written assignment titles, the application file and the attendance registers.`
      ),
    facts: [
      ...(input.visitDateLabel ? [{ label: "Visit", value: input.visitDateLabel }] : []),
      { label: "Portfolios", value: portfoliosValue },
      { label: "Access ends", value: input.accessEndsLabel },
    ],
    cta: { label: "Open the assessment pack", url: input.packUrl },
    footnote: "No account and no password. The link identifies you; opening it is all that is needed.",
  });
}
