import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { distinctTpDates, type TpTimetableEvent } from "@/lib/rotation";
import type { FormalLetterInput } from "@/lib/formal-letter-pdf/document";

// Letters.dc.html 1a: "A provisional grade of Fail, or Fail/Pass, at any
// point after the Stage 3 tutorial." Slashed pairs (migration 0036) are the
// three real "undecided" states -- Fail/Pass is the one that includes Fail
// as a live possibility, so it triggers the same as an outright Fail.
export function isFailRiskTriggered(record: {
  provisional_grade: string | null;
  stage3_tutorial_given: boolean;
}): boolean {
  return Boolean(record.stage3_tutorial_given && record.provisional_grade === "Fail");
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export interface FailRiskDraft {
  input: FormalLetterInput;
  facts: { candidateName: string; courseId: string; traineeId: string };
}

// Builds the drafted letter -- everything here is read-only fact, plus a
// starting point for the two prose fields (action points, closing) a
// trainer can still edit before issuing. "Two lessons still to teach" is
// read from plan_assignments (taught_at is null), the closest real signal
// to Admin Handbook 9.2's timing requirement.
export async function buildFailRiskDraft(
  supabase: SupabaseClient<Database>,
  courseId: string,
  traineeId: string,
  issuedByName: string
): Promise<FailRiskDraft | null> {
  const [{ data: trainee }, { data: course }, { data: record }, { data: planAssignments }, { data: allEvents }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", traineeId).maybeSingle(),
    supabase.from("courses").select("name, start_date, end_date, center_id").eq("id", courseId).maybeSingle(),
    supabase
      .from("celta5_records")
      .select("stage3_tutor_notes, stage3_tutor_written_assignments_notes, stage3_tutor_other_notes, stage3_finalized_at")
      .eq("trainee_id", traineeId)
      .maybeSingle(),
    supabase.from("plan_assignments").select("tp_number, taught_at").eq("trainee_id", traineeId).order("tp_number"),
    supabase.from("course_timetable_events").select("event_date").eq("course_id", courseId),
  ]);
  if (!trainee || !course) return null;

  const { data: center } = await supabase.from("centers").select("name, center_number").eq("id", course.center_id).maybeSingle();
  const { data: mct } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("course_id", courseId)
    .eq("tutor_role", "main_course_tutor")
    .maybeSingle();

  const remaining = (planAssignments ?? []).filter((p) => !p.taught_at).map((p) => `TP${p.tp_number}`);
  const today = new Date().toISOString().slice(0, 10);
  const distinctDates = distinctTpDates((allEvents ?? []) as TpTimetableEvent[]);
  const dayIndex = distinctDates.indexOf(today);
  const dayLine = dayIndex >= 0 ? `Day ${dayIndex + 1} of ${distinctDates.length}` : null;

  const actionPointsSource = [record?.stage3_tutor_notes, record?.stage3_tutor_written_assignments_notes, record?.stage3_tutor_other_notes]
    .filter(Boolean)
    .join("\n");
  const actionPoints = actionPointsSource
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const mctIsIssuer = mct?.full_name === issuedByName;

  const input: FormalLetterInput = {
    centerName: center?.name ?? "Your centre",
    centerSubtitle: `Cambridge CELTA centre${center?.center_number ? ` · ${center.center_number}` : ""}`,
    centerLogoUrl: null,
    kicker: "Formal notice · potential fail",
    docTitle: "Notice of a potential Fail outcome",
    dateLabel: formatDate(today),
    dayLine,
    facts: [
      { label: "Candidate", value: trainee.full_name },
      { label: "Course", value: `${course.name} (${formatDate(course.start_date)} – ${formatDate(course.end_date)})` },
      { label: "Main tutor", value: mct?.full_name ?? "Not yet assigned" },
      { label: "Lessons left", value: remaining.length > 0 ? remaining.join(" and ") : "None recorded" },
    ],
    body: [
      `Dear ${trainee.full_name.split(" ")[0]},`,
      "Following your Stage 3 tutorial, we are writing to make clear that on your current progress you are at risk of a Fail outcome on this course. This letter is not a decision. It is a formal notice, given while you still have assessed lessons to teach, so that you have the opportunity and the information to change the outcome.",
      "Your tutors have identified the following action points in your CELTA 5 record. They are the areas your remaining lessons will be judged against.",
    ],
    list: { title: "Action points from your CELTA 5, Stage 3 record", items: actionPoints },
    closing:
      remaining.length > 0
        ? `Your remaining lessons are ${remaining.join(" and ")}. Please come and talk to your tutor before the first of them -- the slots are in the timetable, and we would rather you used one than not.`
        : "Please talk to your tutor as soon as possible.",
    // Ramy, per the source design: "If the MCT ran it themselves, the first
    // two collapse into one." There's no stored record of who specifically
    // conducted the Stage 3 tutorial (celta5_records has no such field), so
    // the issuing tutor stands in for that signal -- if they're the MCT,
    // two signatures; otherwise three, same as the design's own rule.
    signatures: mctIsIssuer
      ? [
          { label: "Main course tutor", value: `${issuedByName} · ${formatDate(today)}`, filled: true },
          { label: "Received by candidate", value: "Awaiting acknowledgement", filled: false },
        ]
      : [
          { label: "Course tutor", value: `${issuedByName} · ${formatDate(today)}`, filled: true },
          { label: "Main course tutor", value: mct?.full_name ? `${mct.full_name} · ${formatDate(today)}` : "Not yet assigned", filled: Boolean(mct?.full_name) },
          { label: "Received by candidate", value: "Awaiting acknowledgement", filled: false },
        ],
    filedNote: `Filed in CELTA 5 Section A · visible to the assessor · exported with the course at close-out. This is ${center?.name ?? "the centre"}'s document; Connect produced it and does not appear on it.`,
  };

  return { input, facts: { candidateName: trainee.full_name, courseId, traineeId } };
}
