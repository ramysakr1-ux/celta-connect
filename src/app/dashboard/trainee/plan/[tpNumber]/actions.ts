"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type {
  AnalysisBlock,
  LanguageAnalysisType,
  PlanProcedureRow,
  ProblemSolutionPair,
  VocabRow,
} from "@/lib/tp-plan-content";

export interface FormState {
  error: string | null;
}

function optionalString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value ? value : null;
}

function parseJsonField<T>(formData: FormData, key: string, fallback: T): T {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseTpNumber(formData: FormData): number | null {
  const n = Number(formData.get("tp_number"));
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : null;
}

async function getOrCreatePlanId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainee: { id: string; course_id: string | null },
  tpNumber: number
): Promise<string> {
  const { data: existing } = await supabase
    .from("tp_plans")
    .select("id")
    .eq("trainee_id", trainee.id)
    .eq("tp_number", tpNumber)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: assignment } = await supabase
    .from("plan_assignments")
    .select("id")
    .eq("trainee_id", trainee.id)
    .eq("tp_number", tpNumber)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("tp_plans")
    .insert({
      course_id: trainee.course_id!,
      trainee_id: trainee.id,
      tp_number: tpNumber,
      plan_assignment_id: assignment?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error("Could not create the lesson plan.");
  return created.id;
}

async function savePlan(formData: FormData, lock: boolean): Promise<FormState> {
  const trainee = await requireRole("trainee");
  const tpNumber = parseTpNumber(formData);
  if (!tpNumber) return { error: "Invalid TP number." };

  const supabase = await createClient();
  let planId: string;
  try {
    planId = await getOrCreatePlanId(supabase, trainee, tpNumber);
  } catch {
    return { error: "Could not open this lesson plan. Refresh and try again." };
  }

  // Language analysis is saved first, while the plan is still unlocked --
  // saving it after locking tp_plans would fail its own RLS check, which
  // gates writes on the parent plan being unsubmitted.
  const laType = formData.get("la_type") as LanguageAnalysisType | null;
  if (laType && formData.get("la_has_content") === "1") {
    const blocks = parseJsonField<AnalysisBlock[]>(formData, "la_blocks", []);
    const vocabRows = parseJsonField<VocabRow[]>(formData, "la_vocab_rows", []);
    const { error: laError } = await supabase.from("tp_language_analyses").upsert(
      {
        tp_plan_id: planId,
        trainee_id: trainee.id,
        type: laType,
        is_main_aim: formData.get("la_main_aim") === "Yes",
        context: optionalString(formData.get("la_context")),
        blocks: laType === "vocab" ? [] : blocks,
        vocab_rows: laType === "vocab" ? vocabRows : [],
        vocab_reference: optionalString(formData.get("la_vocab_reference")),
      },
      { onConflict: "tp_plan_id" }
    );
    if (laError) return { error: "Could not save the language analysis. Try again." };
  }

  const anticipatedProblems = parseJsonField<ProblemSolutionPair[]>(formData, "anticipated_problems", []);
  const procedure = parseJsonField<PlanProcedureRow[]>(formData, "procedure", []);

  const { error: planError } = await supabase
    .from("tp_plans")
    .update({
      main_aims: optionalString(formData.get("main_aims")),
      subsidiary_aims: optionalString(formData.get("subsidiary_aims")),
      personal_aims: optionalString(formData.get("personal_aims")),
      class_profile: optionalString(formData.get("class_profile")),
      materials_description: optionalString(formData.get("materials_description")),
      anticipated_problems: anticipatedProblems,
      framework_used: optionalString(formData.get("framework_used")),
      procedure,
      ...(lock ? { submitted_at: new Date().toISOString() } : {}),
    })
    .eq("id", planId);

  if (planError) {
    return { error: "Could not save the lesson plan. It may already be locked." };
  }

  revalidatePath(`/dashboard/trainee/plan/${tpNumber}`);
  revalidatePath("/dashboard/trainee/plan");
  return { error: null };
}

export async function saveLessonPlanDraft(_prevState: FormState, formData: FormData): Promise<FormState> {
  return savePlan(formData, false);
}

export async function submitLessonPlan(_prevState: FormState, formData: FormData): Promise<FormState> {
  return savePlan(formData, true);
}

export async function reopenLessonPlan(formData: FormData): Promise<void> {
  const trainer = await requireRole("trainer");
  const planId = formData.get("plan_id");
  const traineeId = formData.get("trainee_id");
  const tpNumber = formData.get("tp_number");
  if (typeof planId !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("tp_plans")
    .update({ submitted_at: null })
    .eq("id", planId)
    .eq("course_id", trainer.course_id!);

  if (typeof traineeId === "string") {
    revalidatePath(`/dashboard/trainer/trainees/${traineeId}/tp/${tpNumber}`);
  }
}
