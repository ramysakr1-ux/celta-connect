import "server-only";
import { createAnthropicClient, getAnthropicModel } from "@/lib/anthropic/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SECTION_SKELETONS, type AssignmentTypeValue, type TemplateSection } from "@/lib/assignment-templates/content";

// Mirrors src/lib/tp-library/generate.ts's streamed tool-call pattern --
// same reasoning throughout (streaming for potentially-long requests,
// manual raw-JSON accumulation instead of trusting the SDK's toolUse.input
// reconstruction, tolerating a stringified "sections" field).

const SUBMIT_SECTIONS_TOOL = {
  name: "submit_assignment_sections",
  description:
    "Submit the chunked section breakdown of this assignment brief. The sections field MUST be a real JSON array, never a string.",
  input_schema: {
    type: "object" as const,
    properties: {
      sections: {
        type: "array" as const,
        description: "A native JSON array of section objects, in the order a trainee should complete them.",
        items: {
          type: "object" as const,
          properties: {
            key: {
              type: "string",
              description: "A short, unique, url-safe identifier for this section, e.g. 'learner_profile'.",
            },
            title: { type: "string", description: "The section heading, in the centre's own wording." },
            instruction: {
              type: "string",
              description: "The full instruction text for this section, taken verbatim (or lightly cleaned up) from the brief.",
            },
          },
          required: ["key", "title", "instruction"],
        },
      },
    },
    required: ["sections"],
  },
};

function buildPrompt(assignmentType: AssignmentTypeValue): string {
  const skeleton = DEFAULT_SECTION_SKELETONS[assignmentType];
  return `You are converting a CELTA "${assignmentType}" written assignment brief (attached, from a training centre) into the chunked "instruction on top of a response box" structure CELTA Connect uses.

Break the brief into an ordered list of sections a trainee will complete one at a time. Each section needs a short unique key, a title, and the instruction text for that section, preserving the centre's own wording as closely as possible (light cleanup for clarity is fine; do not invent requirements the brief doesn't contain).

A typical breakdown for this assignment type looks roughly like: ${skeleton.join(" / ")} -- but follow the ACTUAL structure and wording of the attached brief, not this list, if the centre's brief is organised differently. For "LRT" specifically, if the brief covers multiple target language items, produce one section (or a small group of sections) per item, not just one section total.

Do not include instructions about word count, formatting, or submission logistics as their own section -- only the actual analytical/reflective task content.`;
}

interface GeneratedSection {
  key: string;
  title: string;
  instruction: string;
}

export async function generateAssignmentTemplateSections(templateId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: template, error: fetchError } = await admin
    .from("assignment_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (fetchError || !template) {
    throw new Error("Assignment template not found");
  }

  await admin.from("assignment_templates").update({ generation_status: "processing" }).eq("id", templateId);

  try {
    const { data: pdfBlob, error: downloadError } = await admin.storage
      .from("assignment-briefs")
      .download(template.storage_path);
    if (downloadError || !pdfBlob) {
      throw new Error(`Could not download PDF: ${downloadError?.message}`);
    }

    const pdfBase64 = Buffer.from(await pdfBlob.arrayBuffer()).toString("base64");

    const anthropic = createAnthropicClient();
    const stream = anthropic.messages.stream({
      model: getAnthropicModel(),
      max_tokens: 8000,
      tools: [SUBMIT_SECTIONS_TOOL],
      tool_choice: { type: "tool", name: "submit_assignment_sections" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            },
            { type: "text", text: buildPrompt(template.assignment_type) },
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

    let parsedInput: { sections?: unknown };
    try {
      parsedInput = JSON.parse(rawInputJson);
    } catch {
      throw new Error("Claude's response could not be parsed. Try again.");
    }

    let sections: unknown = parsedInput.sections;
    if (typeof sections === "string") {
      try {
        sections = JSON.parse(sections);
      } catch {
        throw new Error("Claude's response could not be parsed. Try again.");
      }
    }
    if (!Array.isArray(sections) || sections.length === 0) {
      throw new Error("No sections were generated");
    }

    const cleanSections: TemplateSection[] = (sections as GeneratedSection[]).map((s) => ({
      key: s.key,
      title: s.title,
      instruction: s.instruction,
    }));

    const { error: updateError } = await admin
      .from("assignment_templates")
      .update({ sections: cleanSections, generation_status: "completed", generation_error: null })
      .eq("id", templateId);
    if (updateError) {
      throw new Error(`Could not save generated sections: ${updateError.message}`);
    }
  } catch (err) {
    await admin
      .from("assignment_templates")
      .update({
        generation_status: "failed",
        generation_error: err instanceof Error ? err.message : "Unknown error",
      })
      .eq("id", templateId);
    throw err;
  }
}
