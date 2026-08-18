import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { FormalLetterInput } from "@/lib/formal-letter-pdf/document";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export interface WithdrawalLetterInput {
  traineeId: string;
  traineeName: string;
  courseId: string;
  courseName: string;
  courseStartDate: string;
  courseEndDate: string;
  centerName: string;
  centerNumber: string | null;
  withdrawnAt: string;
  reportable: boolean;
  note: string | null;
  entryFormSentAt: string | null;
  issuedByName: string;
}

// Letters.dc.html 1c: "the candidate writes it, the centre countersigns."
// Rebuilds the earlier plain confirmation letter (which openly noted the
// real design file wasn't available yet) to match the actual spec's rich
// shape -- kept on the existing withdrawal operational model (profiles.
// course_status et al, migration 0066), not migrated onto formal_letters,
// since that model already works end-to-end and this is a content/design
// upgrade, not a new flow.
export async function buildWithdrawalLetterInput(
  supabase: SupabaseClient<Database>,
  input: WithdrawalLetterInput
): Promise<FormalLetterInput> {
  const [{ data: planAssignments }, { data: assignments }, { data: subgroupMember }] = await Promise.all([
    supabase.from("plan_assignments").select("tp_number, taught_at").eq("trainee_id", input.traineeId),
    supabase.from("assignments").select("assignment_type, first_status, resubmission_outcome").eq("trainee_id", input.traineeId),
    supabase.from("course_subgroup_members").select("subgroup_id").eq("trainee_id", input.traineeId).maybeSingle(),
  ]);

  const taughtCount = (planAssignments ?? []).filter((p) => p.taught_at).length;
  const passedCount = (assignments ?? []).filter((a) => a.first_status === "approved" || a.resubmission_outcome === "pass").length;

  let groupLabel = "your teaching practice group";
  if (subgroupMember) {
    const { data: subgroup } = await supabase.from("course_subgroups").select("name").eq("id", subgroupMember.subgroup_id).maybeSingle();
    if (subgroup?.name) groupLabel = `Group ${subgroup.name}`;
  }

  const retentionNote =
    "your record is kept, not deleted, until the centre's export at close-out, after which it is removed from Connect in line with the terms you accepted at sign-up.";

  return {
    centerName: input.centerName,
    centerSubtitle: `Cambridge CELTA centre${input.centerNumber ? ` · ${input.centerNumber}` : ""}`,
    centerLogoUrl: null,
    kicker: "Candidate declaration",
    docTitle: "Withdrawal from the course",
    dateLabel: formatDate(input.withdrawnAt.slice(0, 10)),
    dayLine: null,
    facts: [
      { label: "Candidate", value: input.traineeName },
      { label: "Course", value: `${input.courseName} (${formatDate(input.courseStartDate)} – ${formatDate(input.courseEndDate)})` },
      { label: "Entry form", value: input.entryFormSentAt ? `Submitted ${formatDate(input.entryFormSentAt)}` : "Not yet submitted" },
      { label: "Reported as", value: input.reportable ? "Withdrawn" : "Internal record only" },
    ],
    body: [
      `I am writing to confirm that I am withdrawing from the CELTA course ${input.courseName} at ${input.centerName}, with effect from ${formatDate(input.withdrawnAt.slice(0, 10))}.`,
      input.note ? `My reason for withdrawing is: ${input.note}.` : "My reason for withdrawing has been discussed with the centre.",
      input.reportable
        ? `I understand that because the course entry form was submitted to Cambridge on ${input.entryFormSentAt ? formatDate(input.entryFormSentAt) : "an earlier date"}, my result will be recorded and reported as Withdrawn. I understand that this is final and that I cannot rejoin this course.`
        : "I understand that because the course entry form had not yet been submitted to Cambridge, this withdrawal is an internal record only.",
    ],
    list: {
      title: "What happens to your record",
      items: [
        `Your portfolio is paused as it stands -- ${taughtCount} lesson${taughtCount === 1 ? "" : "s"} taught, ${passedCount} assignment${passedCount === 1 ? "" : "s"} passed -- and becomes read-only. Nothing is deleted.`,
        `Your teaching practice slot in ${groupLabel} is left empty. The rotation for the other candidates does not change.`,
        "Your file remains available to the Cambridge assessor, who is required to review it and record the reason for withdrawal.",
        `At the end of the course, ${retentionNote}`,
      ],
    },
    closing:
      "You may continue to attend input sessions as an observer if you wish, and you would be welcome to. You will not be observed or assessed.",
    signatures: [
      { label: "Candidate", value: `${input.traineeName} · ${formatDate(input.withdrawnAt.slice(0, 10))}`, filled: true },
      { label: "Centre, countersigned", value: `${input.issuedByName} · ${formatDate(input.withdrawnAt.slice(0, 10))}`, filled: true },
    ],
    filedNote: `Filed with the course record · ${input.reportable ? "reported to Cambridge on the final grades" : "internal record only"} · included in the assessor pack marked Withdrawn. This is ${input.centerName}'s document; Connect produced it and does not appear on it.`,
  };
}
