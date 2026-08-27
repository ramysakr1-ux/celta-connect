import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { readSelectionTask, type SelectionTaskReading } from "@/lib/openai/read-selection-task";
import { readSpeakingTask } from "@/lib/openai/read-speaking-task";

export type TriageLane = "clear" | "borderline" | "clear_problems";

// specs/for-claude-code-email-inventory.md Part 1: "clear on every criterion"
// books an interview; "clear problems" notifies a tutor; everything else is
// borderline, queued for a human. The app never writes a rejection at any
// confidence (twenty-decisions.md 11a), so there is no fourth lane -- the
// worst outcome routes to a person, never to a decline.
//
// Judgement call, documented rather than guessed silently: language
// awareness is the one row Admin Handbook 7.3 treats as a hard entry
// requirement ("competence in written and spoken English... recommended
// level C2 or C1+"), so a "below" there alone is enough to flag rather than
// merely queue. Any other single "below" is borderline; two or more "below"
// rows (of any kind) is also clear_problems -- a pattern across the
// submission, not one weak paragraph.
export function deriveTriageLane(reading: SelectionTaskReading): TriageLane {
  const rows = [reading.language_awareness, reading.accuracy, reading.organisation, reading.range, reading.substance];
  const belowCount = rows.filter((r) => r.level === "below").length;

  if (belowCount === 0) return "clear";
  if (reading.language_awareness.level === "below" || belowCount >= 2) return "clear_problems";
  return "borderline";
}

// Shadow mode first (review-notes.md): every applicant gets a reading once
// a centre turns shadow mode on, recorded regardless of the autobook
// setting. Autobook only decides whether the "clear" lane's interview
// invitation is actually scheduled to send -- never applies to the other
// two lanes, which are always human-routed with nothing sent automatically.
export async function runSelectionTaskTriage(
  admin: SupabaseClient<Database>,
  applicantId: string
): Promise<{ ran: boolean; lane: TriageLane | null }> {
  const { data: applicant } = await admin
    .from("applicants")
    .select(
      "id, center_id, full_name, intake_course_id, language_awareness_submission, writing_task_submission, writing_task_prompt_id, task_feedback_ai_suggestion, speaking_task_transcript, speaking_task_prompt_id, speaking_task_ai_suggestion"
    )
    .eq("id", applicantId)
    .maybeSingle();
  if (!applicant) return { ran: false, lane: null };

  const { data: center } = await admin
    .from("centers")
    .select("admissions_ai_shadow_mode_enabled, admissions_ai_autobook_enabled")
    .eq("id", applicant.center_id)
    .maybeSingle();
  if (!center?.admissions_ai_shadow_mode_enabled) return { ran: false, lane: null };

  let writingPrompt: string | null = null;
  if (applicant.writing_task_prompt_id) {
    const { data: prompt } = await admin
      .from("application_writing_prompts")
      .select("prompt_text")
      .eq("id", applicant.writing_task_prompt_id)
      .maybeSingle();
    writingPrompt = prompt?.prompt_text ?? null;
  }

  const reading = await readSelectionTask({
    languageAwarenessQA: applicant.language_awareness_submission ?? [],
    writingPrompt,
    writingSubmission: applicant.writing_task_submission,
  });
  if (!reading) return { ran: false, lane: null };

  const lane = deriveTriageLane(reading);
  const nowIso = new Date().toISOString();

  const update: Database["public"]["Tables"]["applicants"]["Update"] = {
    ai_reading_summary: reading,
    ai_reading_generated_at: nowIso,
    ai_reading_lane: lane,
    // The same reading also fills the standing "what to say about their
    // task" suggestion slot on the marking form -- one reading, shown in
    // two places, never two separate generations of the same submission.
    task_feedback_ai_suggestion: applicant.task_feedback_ai_suggestion ?? reading.summary,
  };

  // Speaking task: its own suggestion, generated the same shadow-mode-gated
  // run as the writing/language-awareness reading above, but deliberately
  // outside deriveTriageLane -- it never affects the lane, autobook, or
  // clear-problems notification, all of which are scoped to Admin Handbook
  // 6.3's writing/language-awareness scheme only.
  if (applicant.speaking_task_transcript && !applicant.speaking_task_ai_suggestion) {
    let speakingPrompt: string | null = null;
    if (applicant.speaking_task_prompt_id) {
      const { data: prompt } = await admin
        .from("speaking_task_prompts")
        .select("prompt_text")
        .eq("id", applicant.speaking_task_prompt_id)
        .maybeSingle();
      speakingPrompt = prompt?.prompt_text ?? null;
    }
    const speakingSuggestion = await readSpeakingTask({
      prompt: speakingPrompt,
      transcript: applicant.speaking_task_transcript,
    });
    if (speakingSuggestion) {
      update.speaking_task_ai_suggestion = speakingSuggestion;
      update.speaking_task_ai_suggestion_generated_at = nowIso;
    }
  }

  if (lane === "clear" && center.admissions_ai_autobook_enabled) {
    const holdUntil = new Date(Date.now() + 15 * 60 * 1000);
    update.interview_auto_send_at = holdUntil.toISOString();
  } else if (lane === "clear_problems") {
    update.clear_problems_notified_at = nowIso;
  }

  await admin.from("applicants").update(update).eq("id", applicantId);

  if (lane === "clear_problems") {
    // Kept as its own in-app row -- "a tutor is notified... in-app only" --
    // alongside the email+push below, which now covers every lane.
    await notifyClearProblems(admin, { applicantId, centerId: applicant.center_id });
  }
  await notifyReadingComplete(admin, { applicant, lane, reading });

  return { ran: true, lane };
}

// Ramy, 27 Aug 2026: "when API sends the notification that someone has
// completed their preinterview task with a suggestion" -- email + push to
// every admissions handler at the centre, for any lane. Never blocks the
// triage result on a delivery failure.
async function notifyReadingComplete(
  admin: SupabaseClient<Database>,
  input: {
    applicant: { id: string; center_id: string; full_name: string; intake_course_id: string | null };
    lane: TriageLane;
    reading: SelectionTaskReading;
  }
): Promise<void> {
  const { data: course } = input.applicant.intake_course_id
    ? await admin.from("courses").select("name").eq("id", input.applicant.intake_course_id).maybeSingle()
    : { data: null };
  const courseName = course?.name ?? "the course";
  const laneLabel = LANE_COPY_LABEL[input.lane];

  const { notifyAdmissionsHandlers } = await import("@/lib/admissions-notify");
  const { aiReadingCompleteEmailHtml } = await import("@/lib/admissions-email");
  const siteUrl = process.env.SITE_URL ?? "https://celtaconnect.com";
  const reviewUrl = `${siteUrl}/dashboard/admissions/${input.applicant.id}`;

  await notifyAdmissionsHandlers(admin, {
    centerId: input.applicant.center_id,
    applicantId: input.applicant.id,
    emailType: "reading_flagged",
    subject: `Task reading ready -- ${input.applicant.full_name} (${laneLabel})`,
    pushBody: `${input.applicant.full_name}'s task reading is ready -- ${laneLabel.toLowerCase()}.`,
    pushUrl: reviewUrl,
    buildEmailHtml: (recipientName) =>
      aiReadingCompleteEmailHtml({
        recipientName,
        applicantName: input.applicant.full_name,
        courseName,
        laneLabel,
        summary: input.reading.summary,
        reviewUrl,
      }),
  }).catch(() => null);
}

const LANE_COPY_LABEL: Record<TriageLane, string> = {
  clear: "Clear on every criterion",
  borderline: "Mixed / borderline",
  clear_problems: "Clear problems flagged",
};

// "A tutor is notified. Nothing sent. The tutor reads it themselves" --
// in-app only (rule 18: never push/email for this). Reuses the existing
// centre-wide admissions notification feed rather than inventing per-user
// routing infra; the MCT is named in the message as the spec's own
// suggested default (email-inventory.md Part 1: "flag to code rather than
// guess... reasonable default: route to the MCT"), left open for whoever
// actually handles admissions to act on.
async function notifyClearProblems(
  admin: SupabaseClient<Database>,
  input: { applicantId: string; centerId: string }
) {
  const { data: applicant } = await admin
    .from("applicants")
    .select("full_name, intake_course_id")
    .eq("id", input.applicantId)
    .maybeSingle();
  if (!applicant) return;

  const { data: mct } = await admin
    .from("course_tutors")
    .select("profiles(full_name)")
    .eq("course_id", applicant.intake_course_id)
    .eq("tutor_role", "main_course_tutor")
    .maybeSingle();
  const mctName = (mct?.profiles as { full_name?: string } | null)?.full_name ?? null;

  await admin.from("admissions_notifications").insert({
    center_id: input.centerId,
    applicant_id: input.applicantId,
    type: "clear_problems",
    message: mctName
      ? `${applicant.full_name}'s task reading found several concerns -- worth ${mctName} (MCT) reading it directly.`
      : `${applicant.full_name}'s task reading found several concerns -- worth a tutor reading it directly.`,
  });
}
