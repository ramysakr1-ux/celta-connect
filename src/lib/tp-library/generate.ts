import "server-only";
import { createAnthropicClient, getAnthropicModel } from "@/lib/anthropic/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDensityTier, POINTS_PER_TP } from "@/lib/tp-density";
import { LESSON_FRAMEWORKS } from "@/lib/lesson-frameworks";
import type { Database } from "@/lib/supabase/types";

const TP_NUMBERS = [1, 2, 3, 4, 5, 6] as const;

const SUBMIT_TP_POINTS_TOOL = {
  name: "submit_tp_points",
  description:
    "Submit the generated bank of TP points for this coursebook. The points field MUST be a real JSON array, never a string.",
  input_schema: {
    type: "object" as const,
    properties: {
      points: {
        type: "array" as const,
        description:
          "A native JSON array of point objects. Must not be a stringified/escaped JSON string -- confirmed via direct testing that for this large a tool call, the model sometimes emits this field as an escaped string instead of a native array unless explicitly told not to.",
        items: {
          type: "object" as const,
          properties: {
            tp_number: { type: "integer", minimum: 1, maximum: 6 },
            sequence_index: { type: "integer", minimum: 1, maximum: POINTS_PER_TP },
            main_lesson_aim: { type: "string" },
            sub_aim: { type: "string" },
            materials_description: { type: "string" },
            page_references: { type: "string" },
            procedure: {
              description:
                "Shape depends on the TP number's density tier -- see the instructions for exactly which fields to include. Omit entirely for the minimal tier.",
              type: "object",
              additionalProperties: true,
            },
          },
          required: ["tp_number", "sequence_index", "main_lesson_aim"],
        },
      },
    },
    required: ["points"],
  },
};

function buildPrompt(title: string, level: string): string {
  const frameworkList = LESSON_FRAMEWORKS.map(
    (f) => `- "${f.name}": ${f.stages.join(" -> ")}`
  ).join("\n");

  return `You are generating a reusable bank of CELTA Teaching Practice (TP) lesson points from the attached coursebook "${title}" (level ${level}).

Generate exactly ${POINTS_PER_TP} distinct lesson points for EACH TP number 1 through 6 (${POINTS_PER_TP * 6} points total), drawing on different units/pages of the book so the ${POINTS_PER_TP} points for a given TP number are genuinely different lessons. Number each point's sequence_index 1-${POINTS_PER_TP} within its tp_number.

Each TP number has a different density tier, and the shape of the "procedure" field must match:

- TP1 and TP2 ("scripted" tier): main_lesson_aim and sub_aim must be a full CELTA-style sentence (e.g. "By the end of the lesson, Ss will be better able to use... in the context of..."). procedure must be { "stages": [{ "name": string, "timing": string, "instructions": string }] } with real, detailed prose instructions per stage (e.g. stage names like "LEAD IN", "TEST 1 (DIAGNOSTIC)", "TEACH", "CONTROLLED PRACTICE", "FREER PRACTICE", "FEEDBACK ON CONTENT"). IMPORTANT: since trainees this early in the course aren't yet familiar with CELTA jargon, expand any abbreviation on its first use in the instructions text, e.g. "concept checking questions (CCQs)" not just "CCQs", "target language (TL)" not just "TL".
- TP3 and TP4 ("framework" tier): main_lesson_aim and sub_aim are just a bare category + topic (e.g. main_lesson_aim: "Vocabulary: Air Travel", sub_aim: "Speaking"). procedure must be { "framework_name": string, "stages": [{ "name": string, "reference": string }], "analysis_label": string, "analysis_prompt": string }. framework_name must be exactly one of these real named frameworks, and stage names must use that framework's real stage vocabulary:
${frameworkList}
  analysis_label should be one of "Language Analysis", "Grammar Analysis", "Vocabulary Analysis", or "Functional Language Analysis" depending on the main aim's category, with analysis_prompt describing what the trainee should analyze (e.g. "The 6 items of vocabulary you expect to be the most problematic"). Bare abbreviations (CCQ, TTT, etc.) are fine at this tier.
- TP5 ("coaching_prose" tier -- richer than TP6 because it coincides with a coursebook level change): main_lesson_aim/sub_aim are bare category+topic like TP3/4. procedure must be { "guidance_paragraphs": string[] } -- 2-4 paragraphs of pedagogical coaching prose guiding the trainee to design their own lesson (which while-reading/listening tasks to choose, vocabulary to pre-teach, lesson shape options), with NO named stage list.
- TP6 ("minimal" tier): main_lesson_aim/sub_aim bare category+topic. Omit "procedure" entirely -- just the aim and materials_description/page_references.

For every point, materials_description and page_references should cite real pages/exercises from the attached coursebook.

IMPORTANT: the "points" field in your tool call must be a genuine native JSON array value, NOT a JSON-encoded string. Do not wrap the array in quotes or escape it as a string under any circumstances.`;
}

interface GeneratedPoint {
  tp_number: number;
  sequence_index: number;
  main_lesson_aim: string;
  sub_aim?: string;
  materials_description?: string;
  page_references?: string;
  procedure?: unknown;
}

export async function generateTpPointsForCoursebook(coursebookId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: coursebook, error: fetchError } = await admin
    .from("tp_coursebooks")
    .select("*")
    .eq("id", coursebookId)
    .single();

  if (fetchError || !coursebook) {
    throw new Error("Coursebook not found");
  }

  await admin
    .from("tp_coursebooks")
    .update({ generation_status: "processing" })
    .eq("id", coursebookId);

  try {
    const { data: pdfBlob, error: downloadError } = await admin.storage
      .from("coursebook-pdfs")
      .download(coursebook.storage_path);
    if (downloadError || !pdfBlob) {
      throw new Error(`Could not download PDF: ${downloadError?.message}`);
    }

    const pdfBase64 = Buffer.from(await pdfBlob.arrayBuffer()).toString("base64");

    const anthropic = createAnthropicClient();
    // Streamed rather than a plain create() call: the SDK requires
    // streaming for requests that might run past 10 minutes, which a
    // 32000 max_tokens budget on a large PDF can invite.
    //
    // The tool input JSON is accumulated manually from raw
    // input_json_delta events rather than trusting the SDK's own
    // reconstruction (toolUse.input) -- confirmed via direct testing that
    // the SDK's automatic deep-parse of this large/deeply-nested input is
    // unreliable (sometimes a real array, sometimes an unparseable raw
    // string), while simple string concatenation + a single JSON.parse at
    // the end is not.
    const stream = anthropic.messages.stream({
      model: getAnthropicModel(),
      // 18 detailed points (esp. the fully-scripted TP1-2 tier's multi-stage
      // prose) reliably exceeds 8192 output tokens and gets cut off
      // mid-JSON -- confirmed via direct API testing that ~11-13k tokens
      // are needed for a real request; this leaves real headroom.
      max_tokens: 32000,
      tools: [SUBMIT_TP_POINTS_TOOL],
      tool_choice: { type: "tool", name: "submit_tp_points" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            },
            { type: "text", text: buildPrompt(coursebook.title, coursebook.level) },
          ],
        },
      ],
    });

    let rawInputJson = "";
    let stopReason: string | null = null;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
        rawInputJson += event.delta.partial_json;
      }
      if (event.type === "message_delta") {
        stopReason = event.delta.stop_reason;
      }
    }

    if (stopReason === "max_tokens") {
      throw new Error("Claude's response was cut off before finishing. Try again.");
    }
    if (!rawInputJson) {
      throw new Error("Claude did not return the expected tool call");
    }

    let parsedInput: { points?: unknown };
    try {
      parsedInput = JSON.parse(rawInputJson);
    } catch {
      throw new Error("Claude's response could not be parsed. Try again.");
    }

    // For this large/deeply-nested a tool call, the model itself
    // sometimes emits "points" as an escaped JSON string rather than a
    // native nested array (confirmed directly on the raw wire JSON, not
    // an SDK artifact) -- handle both shapes.
    let points: unknown = parsedInput.points;
    if (typeof points === "string") {
      try {
        points = JSON.parse(points);
      } catch {
        throw new Error("Claude's response could not be parsed. Try again.");
      }
    }
    if (!Array.isArray(points) || points.length === 0) {
      throw new Error("No TP points were generated");
    }
    const generatedPoints = points as GeneratedPoint[];

    const rows: Database["public"]["Tables"]["tp_points"]["Insert"][] = generatedPoints.map((p) => ({
      tp_coursebook_id: coursebookId,
      center_id: coursebook.center_id,
      tp_number: p.tp_number,
      sequence_index: p.sequence_index,
      density_tier: getDensityTier(p.tp_number),
      main_lesson_aim: p.main_lesson_aim,
      sub_aim: p.sub_aim ?? null,
      materials_description: p.materials_description ?? null,
      page_references: p.page_references ?? null,
      procedure: (p.procedure ?? null) as never,
      status: "pending_review",
      generation_source: "ai_generated",
    }));

    const { error: insertError } = await admin.from("tp_points").insert(rows);
    if (insertError) {
      throw new Error(`Could not save generated points: ${insertError.message}`);
    }

    await admin
      .from("tp_coursebooks")
      .update({ generation_status: "completed", generation_error: null })
      .eq("id", coursebookId);
  } catch (err) {
    await admin
      .from("tp_coursebooks")
      .update({
        generation_status: "failed",
        generation_error: err instanceof Error ? err.message : "Unknown error",
      })
      .eq("id", coursebookId);
    throw err;
  }
}

export { TP_NUMBERS };
