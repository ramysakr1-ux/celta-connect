// The default wording of the four Cambridge assignments, verbatim from
// specs `for-claude-code-five-assignments-wording.md` (the Connect Hub
// wording builder's DEFAULT_DATA) -- "this is the starting content, not
// placeholder text to improve on."
//
// One source for every centre: the demo seed writes these, and
// `scripts/publish-briefs.mjs` writes them into a real centre that is
// missing a brief. Before this, the seed carried its own hand-written
// wording and Elmswood carried a third version, so the same assignment
// read differently depending on which centre you opened.
//
// `format` is written explicitly and is NOT decoration: Administration
// Handbook June 2025 §9.2.1 -- "At least two of the assignments should be
// written in continuous prose." Focus on the Learner and Lessons from the
// Classroom are the two. The seed had been letting the column default to
// 'structured' for all four, which left the demo centre with zero prose
// assignments and in breach of §9.2.1.

export const DEFAULT_BRIEFS = [
  {
    type: "Focus on Learner",
    format: "prose",
    sections: [
      {
        key: "tp_group",
        title: "A -- Your TP group",
        instruction: "Describe your group of learners, covering group size, gender, age range and level.",
      },
      {
        key: "grammar_problem",
        title: "B -- The grammar problem",
        instruction: "Name the grammar area you've chosen to focus on, using correct terminology, with two examples.",
      },
      {
        key: "pronunciation_problem",
        title: "C -- The pronunciation problem",
        instruction:
          "Name the pronunciation area you've chosen to focus on, using correct terminology and IPA script, with two examples.",
      },
      {
        key: "grammar_task",
        title: "D -- The grammar task",
        instruction:
          "Attach one task in Appendix 1 that addresses the grammar problem above -- just one, not a choice of options.",
      },
      {
        key: "pronunciation_task",
        title: "E -- The pronunciation task",
        instruction:
          "Attach one task in Appendix 2 that addresses the pronunciation problem above. Repeating after the teacher or drilling doesn't count as a task.",
      },
    ],
  },
  {
    type: "LRT",
    format: "structured",
    // The wording spec's LRT is a picker (2 items per category) plus a
    // repeatable analysis block per item. A published template row holds
    // only {key, title, instruction} sections, so until the picker is
    // built the six analysis strands ship as sections and carry the
    // spec's own instruction text for each, word for word.
    sections: [
      {
        key: "pick_items",
        title: "Pick your items",
        instruction:
          "Category A: Grammar item 1 / 2 / 3. Category B: Lexis item 1 / 2 / 3. Pick 2 from each, then analyse each one below. Your centre replaces these placeholder item names with the real ones before the course runs.",
      },
      {
        key: "meaning",
        title: "Meaning",
        instruction: "The essential meaning of the item, in this context.",
      },
      {
        key: "clarification",
        title: "Clarification of meaning",
        instruction: "CCQs (with answers), and/or a timeline, diagram, or personalised example.",
      },
      { key: "form", title: "Form", instruction: "Break down each part. Use accurate, specific terminology." },
      {
        key: "pronunciation",
        title: "Pronunciation",
        instruction: "Phonemic script -- weak forms, stress, linking, problem sounds.",
      },
      {
        key: "appropriacy",
        title: "Appropriacy",
        instruction: "Only where relevant -- register, more/less formal alternatives.",
      },
      {
        key: "problems",
        title: "Anticipated problems & solutions",
        instruction:
          "Cover meaning, form, AND pronunciation -- a solution for each problem you raise.",
      },
    ],
  },
  {
    type: "Skills",
    format: "structured",
    sections: [
      {
        key: "material",
        title: "The material",
        instruction: "The lesson or extract you are analysing -- not the whole unit, just the skills-focused part.",
      },
      {
        key: "subskills",
        title: "Sub-skills and task types",
        instruction:
          "Name the specific sub-skills the material targets (e.g. skimming for gist, listening for specific information, turn-taking, planning before writing) and how each task exercises them.",
      },
      {
        key: "staging",
        title: "How the lesson stages the skill",
        instruction:
          "Lead-in, pre-task (vocabulary/prediction), the task itself, and post-task -- what each stage is for, and how it prepares learners for the next.",
      },
      {
        key: "problems",
        title: "Anticipated problems and solutions",
        instruction:
          "Problems with the skill itself (not language) -- task difficulty, background knowledge, text length, unfamiliar text types -- and how you would address each.",
      },
    ],
  },
  {
    type: "LfC",
    format: "prose",
    sections: [
      {
        key: "strengths",
        title: "A -- Identifying strengths",
        instruction: "Browse your 3 most recent TPs' feedback and identify 3 teaching strengths you've shown.",
      },
      {
        key: "action_points",
        title: "B -- Identifying action points",
        instruction: "Browse your 3 most recent TPs' feedback and identify 3 action points you still have.",
      },
      {
        key: "observation",
        title: "C -- Reflecting on observation of others",
        instruction:
          "For each action point from Part B, give one example of how another teacher addressed it -- through peer observation, a tutor's live observation, or a video observation.",
      },
      {
        key: "post_course",
        title: "D -- Post-course development",
        instruction: "Choose 3 areas you want to focus on after the course.",
      },
    ],
  },
];

/** Writes any of the four briefs this centre does not already have. Never touches one it has. */
export async function publishMissingBriefs(supabase, centerId) {
  const { data: existing, error } = await supabase
    .from("assignment_templates")
    .select("assignment_type")
    .eq("center_id", centerId);
  if (error) throw new Error(`assignment_templates read: ${error.message}`);
  const have = new Set((existing ?? []).map((r) => r.assignment_type));

  const written = [];
  for (const brief of DEFAULT_BRIEFS) {
    if (have.has(brief.type)) continue;
    const { error: insertErr } = await supabase.from("assignment_templates").insert({
      center_id: centerId,
      assignment_type: brief.type,
      // "system:" is the established marker for a brief with no uploaded
      // file behind it (malpractice/actions.ts writes the same shape for
      // the plagiarism reflection).
      storage_path: `system:${brief.type.toLowerCase().replace(/\s+/g, "-")}`,
      sections: brief.sections,
      format: brief.format,
      generation_status: "completed",
      published_at: new Date().toISOString(),
    });
    if (insertErr) throw new Error(`assignment_templates ${brief.type}: ${insertErr.message}`);
    written.push(brief.type);
  }
  return { written, kept: [...have] };
}
