// The pre-course task for the demo centres: Cambridge's Pre-Course Task
// (© UCLES 2018 -- five sections, fifty numbered tasks, the answer key where
// Cambridge supplies one) plus the two centre supplements, "Teaching online"
// and "Using L1 in the classroom".
//
// Why this exists (12 Sep 2026): migration 0230 loaded the real content, with
// 0238/0239 adding the lead-ins and the answer shapes -- for the centres that
// existed on the day each ran. A rebuilt demo centre is a new row, so every
// rebuild since has shipped three placeholder sections that are not
// Cambridge's, with zero tasks in them, under a heading and a welcome email
// that both promise "Cambridge's Pre-Course Task". The seed also still wrote
// responses in the pre-0237 shape (section-keyed, with a submitted_at), which
// failed silently on every run. Same class of fault as the interview question
// bank, fixed the same way: the content is a seed asset, applied to any
// centre that lacks it.
//
// scripts/seed-assets/pre-course-task.json was exported from the one centre
// 0230 reached. Idempotent: a centre that already has Cambridge's tasks is
// left alone; placeholder sections with nothing in them are cleared first.
//
// Run by seed-demo.mjs after both branches exist; also runnable on its own.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CONTENT = JSON.parse(fs.readFileSync(new URL("./seed-assets/pre-course-task.json", import.meta.url), "utf8"));

const { data: centres } = await supabase.from("centers").select("id, name").eq("is_demo", true).order("created_at");
if (!centres?.length) { console.error("precourse: no demo centre"); process.exit(1); }

for (const centre of centres) {
  const { data: existing } = await supabase
    .from("pre_course_task_sections").select("id, source, title").eq("center_id", centre.id);
  const ids = (existing ?? []).map((s) => s.id);
  const { count: itemCount } = ids.length
    ? await supabase.from("pre_course_task_items").select("id", { count: "exact", head: true }).in("section_id", ids)
    : { count: 0 };

  if ((itemCount ?? 0) >= 50) {
    console.log(`precourse: ${centre.name} already has the task (${itemCount} items) -- left alone`);
  } else {
    // Whatever is there is a placeholder with nothing in it. Removing the
    // sections cascades to items and responses, none of which exist.
    if (ids.length) await supabase.from("pre_course_task_sections").delete().in("id", ids);
    let items = 0;
    for (const section of CONTENT) {
      const { data: sec, error } = await supabase
        .from("pre_course_task_sections")
        .insert({ center_id: centre.id, source: section.source, sequence_index: section.sequence_index, title: section.title, prompt: section.prompt })
        .select("id").single();
      if (error) { console.error("precourse: section", section.title, error.message); continue; }
      const { error: itemErr } = await supabase
        .from("pre_course_task_items")
        .insert(section.items.map((it) => ({ ...it, section_id: sec.id })));
      if (itemErr) console.error("precourse: items for", section.title, itemErr.message);
      else items += section.items.length;
    }
    console.log(`precourse: ${centre.name} -- ${CONTENT.length} sections, ${items} items`);
  }

  // What the tutor's "Who's answered what" grid reads. The demo course is in
  // week 3, so the candidates finished the task weeks ago -- but not all of
  // them all of it, or the grid has nothing to say. One row per task per
  // trainee, in the shape the page itself writes (0237): text for open tasks,
  // JSON for structured ones. Only where nothing is recorded yet.
  const { data: trainees } = await supabase
    .from("profiles").select("id, full_name").eq("center_id", centre.id).eq("role", "trainee").order("full_name");
  if (!trainees?.length) continue;
  const { data: secs } = await supabase
    .from("pre_course_task_sections").select("id, source, sequence_index").eq("center_id", centre.id).order("sequence_index");
  const { data: allItems } = await supabase
    .from("pre_course_task_items").select("id, section_id, shape, sequence_index").in("section_id", (secs ?? []).map((s) => s.id)).order("sequence_index");
  const bySection = new Map();
  for (const it of allItems ?? []) (bySection.get(it.section_id) ?? bySection.set(it.section_id, []).get(it.section_id)).push(it);
  const ordered = (secs ?? []).flatMap((s) => bySection.get(s.id) ?? []);

  // Keys exactly as task-answer-box.tsx writes them, or the page shows the
  // task as answered and the boxes as empty: parts and selects by row index
  // ("0"), rows_text by row and column ("0.1"), choices as { choice }, a
  // checklist under "picked". Open tasks are plain text.
  const answerFor = (item) => {
    const shape = item.shape;
    if (!shape || shape.kind === "open") return { response: "Worked through this before the course -- my notes are in the portfolio.", response_kind: "text" };
    const obj = {};
    if (shape.kind === "parts") shape.parts.forEach((_, i) => { obj[String(i)] = "Answered before the course."; });
    else if (shape.kind === "rows_text") shape.rows.forEach((_, i) => { shape.cols.forEach((_, c) => { obj[`${i}.${c}`] = "Answered."; }); });
    else if (shape.kind === "rows_choice" || shape.kind === "rows_choice_text") shape.rows.forEach((_, i) => { obj[String(i)] = { choice: shape.options[i % shape.options.length] }; });
    else if (shape.kind === "rows_select") shape.rows.forEach((_, i) => { obj[String(i)] = shape.options[i % shape.options.length]; });
    else if (shape.kind === "checklist") obj.picked = shape.options.slice(0, shape.pick);
    else return { response: "Answered.", response_kind: "text" };
    return { response: JSON.stringify(obj), response_kind: "json" };
  };

  let written = 0;
  for (let t = 0; t < trainees.length; t++) {
    const trainee = trainees[t];
    const { count: have } = await supabase.from("pre_course_task_responses").select("id", { count: "exact", head: true }).eq("trainee_id", trainee.id);
    if ((have ?? 0) > 0) continue;
    // Most finished it; a couple got most of the way; one barely started.
    const fraction = t % 5 === 4 ? 0.3 : t % 5 === 2 ? 0.8 : 1;
    const todo = ordered.slice(0, Math.round(ordered.length * fraction));
    const rows = todo.map((item) => ({ item_id: item.id, trainee_id: trainee.id, ...answerFor(item), updated_at: new Date(Date.now() - (25 + (t % 7)) * 86400000).toISOString() }));
    const { error } = await supabase.from("pre_course_task_responses").insert(rows);
    if (error) console.error("precourse: responses for", trainee.full_name, error.message); else written += rows.length;
  }
  console.log(`precourse: ${centre.name} -- ${written} answers written for ${trainees.length} candidates`);
}
