"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { isCourseDayReached } from "@/lib/course-day";

export interface FolFormState {
  error: string | null;
  warning: string | null;
}

// "Every candidate contributes to one shared log... by tapping a learner
// from the register mid-observation." No day gate here -- candidates log
// from Day 2 through Day 9 in practice, but nothing breaks if one logs
// earlier or later, so this isn't enforced server-side.
export async function logClassError(formData: FormData): Promise<void> {
  const trainee = await requireRole("trainee");
  const learnerId = formData.get("learner_id");
  const tpClass = formData.get("tp_class");
  const tpNumber = formData.get("tp_number");
  const lessonStage = (formData.get("lesson_stage") as string | null)?.trim() || null;
  const problemType = formData.get("problem_type");
  const note = (formData.get("note") as string | null)?.trim();

  if (
    typeof learnerId !== "string" ||
    typeof tpClass !== "string" ||
    !tpClass ||
    typeof tpNumber !== "string" ||
    typeof problemType !== "string" ||
    !["grammar", "pronunciation"].includes(problemType) ||
    !note
  ) {
    return;
  }
  if (!trainee.course_id) return;

  const supabase = await createClient();
  await supabase.from("class_error_log").insert({
    center_id: trainee.center_id,
    course_id: trainee.course_id,
    logged_by_candidate_id: trainee.id,
    learner_id: learnerId,
    tp_class: tpClass,
    tp_number: Number(tpNumber),
    lesson_stage: lessonStage,
    problem_type: problemType as "grammar" | "pronunciation",
    note,
  });

  revalidatePath(`/portfolio/${trainee.id}`, "layout");
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "with", "without", "for", "of", "to", "in", "on", "at",
  "is", "are", "was", "were", "be", "been", "being", "this", "that", "these", "those", "not",
  "student", "students", "learner", "learners", "said", "says", "use", "used", "using", "some",
]);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/θðʃʒŋ]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

const VAGUE_PHRASES = [
  "grammar mistakes",
  "grammar mistake",
  "grammar issues",
  "grammar problems",
  "pronunciation mistakes",
  "pronunciation mistake",
  "pronunciation issues",
  "pronunciation problems",
  "some errors",
  "various errors",
];

const GRAMMAR_KEYWORDS = [
  "tense", "aspect", "modal", "conditional", "passive", "preposition", "article", "plural",
  "comparative", "superlative", "pronoun", "auxiliary", "gerund", "infinitive", "clause",
  "subject", "verb", "adjective", "adverb", "agreement", "possessive",
];
const PRONUNCIATION_KEYWORDS = [
  "sound", "stress", "intonation", "weak form", "schwa", "consonant", "vowel", "linking",
  "phoneme", "syllable", "voiced", "unvoiced", "diphthong", "connected speech", "/", "ipa",
];

function looksLikeCategory(description: string, keywords: string[]): boolean {
  const lower = description.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

// "System-adjudicated, not trainer-reviewed" -- four soft checks, all
// retryable immediately, never a hard fail except the two real blockers
// (duplicate, genuinely zero evidence). Deliberately simple heuristics per
// spec ("doesn't need full NLP, just needs to stop the emptiest
// submissions") -- not meant to be airtight, meant to catch the obvious
// cases and leave judgement calls to Day 12 marking.
export async function submitFolClaim(_prevState: FolFormState, formData: FormData): Promise<FolFormState> {
  const trainee = await requireRole("trainee");
  const problemType = formData.get("problem_type");
  const description = (formData.get("problem_description") as string | null)?.trim();
  const source = formData.get("source");

  if (
    typeof problemType !== "string" ||
    !["grammar", "pronunciation"].includes(problemType) ||
    !description ||
    typeof source !== "string" ||
    !["pooled_log", "signup_recording"].includes(source)
  ) {
    return { error: "Fill in the problem type and a specific description.", warning: null };
  }
  if (!trainee.course_id) return { error: "Something went wrong. Refresh and try again.", warning: null };

  // Claims open on the Day-10 divergence session, not before -- "Day 10
  // (divergence session): candidate-led... candidates use the app to
  // submit claims against the validation above."
  const supabase = await createClient();
  const dayTenReached = await isCourseDayReached(supabase, trainee.course_id, 10);
  if (!dayTenReached) {
    return { error: "Claims open on the divergence session day, not before.", warning: null };
  }

  // Check 4 -- too vague.
  const words = significantWords(description);
  const lowerDescription = description.toLowerCase();
  if (words.length === 0 || VAGUE_PHRASES.some((p) => lowerDescription.includes(p))) {
    return {
      error: `Name the specific structure or sound -- "third conditional" or the /θ/ sound, not "${description}".`,
      warning: null,
    };
  }

  // Check 2 -- category mismatch (light heuristic, not authoritative).
  const otherType = problemType === "grammar" ? "pronunciation" : "grammar";
  const otherKeywords = otherType === "grammar" ? GRAMMAR_KEYWORDS : PRONUNCIATION_KEYWORDS;
  const ownKeywords = problemType === "grammar" ? GRAMMAR_KEYWORDS : PRONUNCIATION_KEYWORDS;
  if (looksLikeCategory(description, otherKeywords) && !looksLikeCategory(description, ownKeywords)) {
    return {
      error: `This reads like a ${otherType} problem, but you've claimed it under ${problemType}. Check the category, or describe it differently.`,
      warning: null,
    };
  }

  // Check 3 -- zero evidence. Search the pooled log (always readable) and,
  // once unlocked, the sign-up transcripts (RLS already gates this --
  // querying it here naturally returns nothing before Day 10, no extra
  // plumbing needed to respect that gate).
  const { data: logRows } = await supabase
    .from("class_error_log")
    .select("id, note")
    .eq("course_id", trainee.course_id)
    .eq("problem_type", problemType as "grammar" | "pronunciation");
  const { data: transcriptRows } = await supabase
    .from("volunteer_signup_profiles")
    .select("id, transcript")
    .eq("course_id", trainee.course_id)
    .not("transcript", "is", null);

  const matchingLogRows = (logRows ?? []).filter((row) => words.some((w) => row.note.toLowerCase().includes(w)));
  const matchingTranscripts = (transcriptRows ?? []).filter(
    (row) => row.transcript && words.some((w) => row.transcript!.toLowerCase().includes(w))
  );
  const totalMatches = matchingLogRows.length + matchingTranscripts.length;

  if (totalMatches === 0) {
    return {
      error: "Nothing in the class log or transcripts matches this yet. Log more observations, or check the wording.",
      warning: null,
    };
  }

  const { error: insertError } = await supabase.from("fol_claims").insert({
    center_id: trainee.center_id,
    course_id: trainee.course_id,
    candidate_id: trainee.id,
    problem_type: problemType as "grammar" | "pronunciation",
    problem_description: description,
    source: source as "pooled_log" | "signup_recording",
  });
  if (insertError) {
    // The message below is what the person reads; this is what we read.
    console.error("[src/lib/fol:submitFolClaim]", insertError);
    if (insertError.code === "23505") {
      return { error: "That problem's already been claimed. Pick a different specific structure or sound.", warning: null };
}
    return { error: "Could not save the claim. Try again.", warning: null };
  }

  revalidatePath(`/portfolio/${trainee.id}`, "layout");

  // "Only genuinely thin evidence (1-2 logged instances) should surface as
  // a heads-up, not a rejection" -- the claim above already succeeded.
  return {
    error: null,
    warning:
      totalMatches <= 2
        ? "Only 1-2 logged instances back this so far -- worth gathering more before Day 12, but your claim is saved."
        : null,
  };
}
