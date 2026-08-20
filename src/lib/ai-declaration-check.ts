// connect-spec-corrections-for-claude-code.md item 8, per build-spec.md and
// Cambridge's "Advice on the use of generative AI in assessed work" (May
// 2024): the declaration is the control, not detection -- this never tries
// to detect AI-generated content itself, only whether the SUBMISSION'S OWN
// citation shape (which Cambridge requires when AI was used) matches what
// the trainee declared. Soft flag only, at marking time -- never blocks,
// never auto-fails, never auto-passes.

// A quoted passage followed by a parenthetical tool name + year, e.g.
// `"some AI-suggested phrasing" (ChatGPT, 2024)`.
const QUOTE_PLUS_PARENTHETICAL = /"[^"]{10,}"\s*\([A-Za-z][\w .]{1,40},?\s*\d{4}\)/;

// The reference-list entry Cambridge's own citation format requires.
const LLM_REFERENCE_ENTRY = /\[large language model\]/i;

export type AiCitationMismatch = "declared_no_citation" | "undeclared_citation" | null;

export function checkAiCitationShape(fullText: string, aiDeclared: boolean): AiCitationMismatch {
  const hasCitationShape = QUOTE_PLUS_PARENTHETICAL.test(fullText) && LLM_REFERENCE_ENTRY.test(fullText);
  if (aiDeclared && !hasCitationShape) return "declared_no_citation";
  if (!aiDeclared && hasCitationShape) return "undeclared_citation";
  return null;
}

export const AI_CITATION_MISMATCH_LABEL: Record<NonNullable<AiCitationMismatch>, string> = {
  declared_no_citation: "AI declared but no in-text citation detected -- check manually.",
  undeclared_citation: "AI declared \"not used\", but a citation-shaped pattern appears in the text -- check manually.",
};

// Hard block 3 (submission-time, server-enforced): "the link must be a
// well-formed URL." Deliberately permissive -- catching "not a URL at all"
// (a bare word, an email address typo'd into the field), not validating
// the link actually resolves or belongs to a real AI tool.
export function isWellFormedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
