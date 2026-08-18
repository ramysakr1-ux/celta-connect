import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { FormalLetterInput } from "@/lib/formal-letter-pdf/document";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export interface DeferralDraft {
  input: FormalLetterInput;
  facts: { candidateName: string; courseId: string; traineeId: string };
}

// Letters.dc.html 1d: "The Appian form is submitted by the centre, on
// Cambridge's own system -- this document is the centre's record and the
// candidate's letter, not a replacement for it." Reads entirely from the
// existing deferral_transfers row (migration 0071) -- reasons, hours
// carried, and the carried snapshots are already the real source of truth
// this letter needs; nothing here duplicates that state.
export async function buildDeferralDraft(
  supabase: SupabaseClient<Database>,
  courseId: string,
  deferralTransferId: string,
  issuedByName: string
): Promise<DeferralDraft | null> {
  const { data: transfer } = await supabase.from("deferral_transfers").select("*").eq("id", deferralTransferId).maybeSingle();
  if (!transfer || transfer.source_course_id !== courseId) return null;

  const [{ data: trainee }, { data: course }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", transfer.source_trainee_id).maybeSingle(),
    supabase.from("courses").select("name, start_date, end_date, center_id").eq("id", courseId).maybeSingle(),
  ]);
  if (!trainee || !course) return null;

  const { data: center } = await supabase.from("centers").select("name, center_number").eq("id", course.center_id).maybeSingle();

  const totalHours = 120; // Admin Handbook -- fixed course-length figure used consistently elsewhere (e.g. observation-hours.ts's own 6/120 framing).
  const today = new Date().toISOString().slice(0, 10);

  const taughtTps = (transfer.carried_tps ?? []).length;
  const passedAssignments = (transfer.carried_assignments ?? []).filter((a) => a.first_status === "approved" || a.resubmission_outcome === "pass");

  const carries: string[] = [];
  if (taughtTps > 0) {
    carries.push(`Your ${taughtTps} completed teaching practice lesson${taughtTps === 1 ? "" : "s"}, credited and read-only. Your numbering continues from where you left off.`);
  }
  if (passedAssignments.length > 0) {
    carries.push(`${passedAssignments.map((a) => a.assignment_type).join(" and ")}, passed, with their original markers named.`);
  }
  if ((transfer.carried_celta5_matrix ?? []).length > 0) {
    carries.push("Your CELTA 5 criteria as met, each recording who assessed it and on which course.");
  }
  carries.push("What does not carry: chat, your workspace link, and anything not part of the assessed record.");

  const input: FormalLetterInput = {
    centerName: center?.name ?? "Your centre",
    centerSubtitle: `Cambridge CELTA centre${center?.center_number ? ` · ${center.center_number}` : ""}`,
    centerLogoUrl: null,
    kicker: "Centre record · Admin Handbook 6.9",
    docTitle: "Deferral — centre record and candidate letter",
    dateLabel: formatDate(today),
    dayLine: null,
    facts: [
      { label: "Candidate", value: trainee.full_name },
      { label: "Completed", value: `${taughtTps} lesson${taughtTps === 1 ? "" : "s"} · ${transfer.hours_carried} of ${totalHours} hours` },
      { label: "Grounds", value: transfer.reasons.length > 140 ? `${transfer.reasons.slice(0, 140)}…` : transfer.reasons },
      { label: "Must complete by", value: transfer.reintegration_deadline ? formatDate(transfer.reintegration_deadline) : "Not yet set" },
    ],
    body: [
      `Dear ${trainee.full_name.split(" ")[0]},`,
      `Following your request and the grounds provided, ${center?.name ?? "the centre"} supports your application to defer completion of CELTA course ${course.name} to a subsequent course. You have completed more than half of this course, which is the condition Cambridge requires for a deferral rather than a withdrawal.`,
      "The centre is submitting a deferral form in Appian, giving full details of the reasons and the arrangements for your re-integration and completion. Cambridge then confirms the arrangements. Your result on this course will be recorded as Deferred on the centre grade form.",
    ],
    list: { title: "What carries to your next course", items: carries },
    closing: transfer.reintegration_deadline
      ? `You must complete on a course finishing no later than ${formatDate(transfer.reintegration_deadline)}. ${transfer.reintegration_arrangements ?? "We will be in touch about which course suits you."}`
      : (transfer.reintegration_arrangements ?? "We will be in touch about the arrangements for completing on a later course."),
    signatures: [
      { label: "Centre", value: `${issuedByName} · ${formatDate(today)}`, filled: true },
      { label: "Candidate", value: "Awaiting acknowledgement", filled: false },
    ],
    filedNote:
      "The Appian form is submitted by the centre, on Cambridge's own system -- this document is the centre's record and the candidate's letter, not a replacement for it.",
  };

  return { input, facts: { candidateName: trainee.full_name, courseId, traineeId: transfer.source_trainee_id } };
}
