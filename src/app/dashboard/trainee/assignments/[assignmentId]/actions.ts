"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { Database } from "@/lib/supabase/types";
import { runPlagiarismScan } from "@/lib/plagiarism/scan";
import { runLanguagePrecheck } from "@/lib/language-precheck";
import { getCourseReleaseClock } from "@/lib/assignment-release";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

type SectionResponseInsert = Database["public"]["Tables"]["assignment_section_responses"]["Insert"];

export interface FormState {
  error: string | null;
}

interface SectionPayload {
  key: string;
  title: string;
  text: string;
}

function parseSections(formData: FormData): SectionPayload[] {
  const raw = formData.get("sections_payload");
  if (typeof raw !== "string" || !raw) return [];
  try {
    return JSON.parse(raw) as SectionPayload[];
  } catch {
    return [];
  }
}

async function saveResponses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string,
  round: string,
  sections: SectionPayload[]
): Promise<string | null> {
  const isResubmission = round === "resubmission";
  for (const s of sections) {
    const row: SectionResponseInsert = {
      assignment_id: assignmentId,
      section_key: s.key,
      section_title: s.title,
      first_response: isResubmission ? undefined : s.text,
      resubmission_response: isResubmission ? s.text : undefined,
    };
    const { error } = await supabase
      .from("assignment_section_responses")
      .upsert(row, { onConflict: "assignment_id,section_key" });
    if (error) return "Could not save -- this assignment may already be locked.";
  }
  return null;
}

// design_handoff_assignments §7: an assignment is readable from day one but
// WRITABLE only from the day the course timetable sets it. The screen renders
// that state, but a gate the screen alone enforces is not a gate -- both
// writing paths check it here. Null means go ahead.
async function releaseBlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string
): Promise<string | null> {
  const { data: assignment } = await supabase
    .from("assignments")
    .select("assignment_type, course_id, trainee_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment?.course_id) return null;

  const { data: trainee } = await supabase
    .from("profiles")
    .select("center_id")
    .eq("id", assignment.trainee_id)
    .maybeSingle();
  const timeZone = trainee?.center_id ? ((await getCachedCenter(trainee.center_id))?.time_zone ?? DEFAULT_TIMEZONE) : DEFAULT_TIMEZONE;
  const clock = await getCourseReleaseClock(supabase, assignment.course_id, toLocalIso(new Date(), timeZone));
  if (clock.isOpen(assignment.assignment_type)) return null;

  const release = clock.releaseByType.get(assignment.assignment_type);
  return release?.day
    ? `This assignment opens on Day ${release.day}. You can read the brief and the criteria until then.`
    : "This assignment has not opened for writing yet.";
}

export async function saveAssignmentDraft(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainee = await requireRole("trainee");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  if (typeof assignmentId !== "string" || typeof round !== "string") {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const blocked = await releaseBlock(supabase, assignmentId);
  if (blocked) return { error: blocked };
  const error = await saveResponses(supabase, assignmentId, round, parseSections(formData));
  if (error) return { error };

  revalidatePath(`/portfolio/${trainee.id}/assignments/${assignmentId}`);
  return { error: null };
}

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

export async function submitAssignment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainee = await requireRole("trainee");
  const assignmentId = formData.get("assignment_id");
  const round = formData.get("round");
  if (typeof assignmentId !== "string" || typeof round !== "string") {
    return { error: "Invalid request." };
  }

  const sections = parseSections(formData);
  const totalWords = sections.reduce((sum, s) => sum + wordCount(s.text), 0);
  const aiDeclared = formData.get("ai_declared") === "true";
  const aiConversationUrl = formData.get("ai_conversation_url");
  const ownWorkConfirmed = formData.get("own_work_confirmed") === "true";

  const supabase = await createClient();
  const blocked = await releaseBlock(supabase, assignmentId);
  if (blocked) return { error: blocked };
  const saveError = await saveResponses(supabase, assignmentId, round, sections);
  if (saveError) return { error: saveError };

  const { error } = await supabase.rpc("submit_assignment_round", {
    p_assignment_id: assignmentId,
    p_word_count: totalWords,
    p_ai_declared: aiDeclared,
    p_ai_conversation_url: typeof aiConversationUrl === "string" ? aiConversationUrl : null,
    p_own_work_confirmed: ownWorkConfirmed,
  });
  if (error) return { error: error.message };

  // Stamp which published version of the brief this answered (migration
  // 0300). Done here rather than inside submit_assignment_round because the
  // RPC has no idea which centre's template applies -- and because a failure
  // to stamp must never undo a submission that has already succeeded.
  try {
    const { data: a } = await supabase
      .from("assignments")
      .select("assignment_type, template_version_id")
      .eq("id", assignmentId)
      .maybeSingle();
    if (a && !a.template_version_id) {
      const { data: tmpl } = await supabase
        .from("assignment_templates")
        .select("id")
        .eq("center_id", trainee.center_id)
        .eq("assignment_type", a.assignment_type)
        .maybeSingle();
      if (tmpl) {
        const { data: version } = await supabase
          .from("assignment_template_versions")
          .select("id")
          .eq("template_id", tmpl.id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (version) await supabase.from("assignments").update({ template_version_id: version.id }).eq("id", assignmentId);
      }
    }
  } catch (stampError) {
    console.error("Could not stamp the brief version for assignment", assignmentId, stampError);
  }

  // build-spec.md: the scanner "runs automatically on submission, visible
  // to tutors only". A scan failure must never block the trainee's
  // submission, which already succeeded above -- log and move on.
  try {
    await runPlagiarismScan(assignmentId, round === "resubmission" ? "resubmission" : "first");
  } catch (scanError) {
    console.error("Plagiarism scan failed for assignment", assignmentId, scanError);
  }

  // connect-decision-language-precheck.md: same non-blocking shape as the
  // plagiarism scan above -- advisory only, never holds up a submission
  // that already succeeded.
  try {
    await runLanguagePrecheck(assignmentId, round === "resubmission" ? "resubmission" : "first");
  } catch (precheckError) {
    console.error("Language pre-check failed for assignment", assignmentId, precheckError);
  }

  revalidatePath(`/portfolio/${trainee.id}/assignments/${assignmentId}`);
  revalidatePath(`/portfolio/${trainee.id}/assignments`);
  return { error: null };
}

// for-claude-code-trainee-interface.md's Assignments tab: "can withdraw only
// while it's unopened; once a tutor opens it, it locks to 'being marked.'"
// This app has no "opened_at" tracking at all (marker_id is only set once a
// trainer actually returns a decision, not when they merely view it), so
// the closest real signal available is first_status still being 'submitted'
// -- coarser than "opened," but honest about what the schema can actually
// tell. Goes through the withdraw_assignment_submission RPC (migration 0097)
// rather than a plain .update() -- migration 0023 dropped the trainee's
// direct UPDATE policy on assignments, so a plain client-side update matches
// zero rows and silently no-ops. The RPC's own WHERE guard is the atomic
// check: if a trainer's decision landed between page load and this click,
// first_status has already moved on and the update simply matches zero rows.
export async function withdrawAssignmentSubmission(formData: FormData): Promise<void> {
  const trainee = await requireRole("trainee");
  const assignmentId = formData.get("assignment_id");
  if (typeof assignmentId !== "string") return;

  const supabase = await createClient();
  await supabase.rpc("withdraw_assignment_submission", { p_assignment_id: assignmentId });

  revalidatePath(`/portfolio/${trainee.id}/assignments/${assignmentId}`);
  revalidatePath(`/portfolio/${trainee.id}/assignments`);
}
