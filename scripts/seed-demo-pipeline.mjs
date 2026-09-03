// Fills the two DEMO centres with a pipeline that looks like a centre actually
// recruiting. Ramy, 2 Sep 2026: "I'm supposed to be showing this as a demo, and
// it just seems like they're not doing very well. Zero money collected... very
// few admissions. They could have made things look a little better."
//
// He was right: New York had three applicants and Los Angeles had none at all,
// so every money figure read zero and switching branches went from three rows
// to an empty page. Demo centres only -- never Elmswood.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const NY = [["Marta Kowalski","marta.kowalski"],["Yusuf Demir","yusuf.demir"],["Chiara Rossi","chiara.rossi"],
  ["Tomás Herrera","tomas.herrera"],["Aiko Tanaka","aiko.tanaka"],["Farah Haddad","farah.haddad"],
  ["Lucas Meyer","lucas.meyer"],["Nadia Petrova","nadia.petrova"],["Owen Blackwood","owen.blackwood"]];
const LA = [["Sofia Marquez","sofia.marquez"],["Daniel Osei","daniel.osei"],["Hana Kim","hana.kim"],
  ["Ravi Chandran","ravi.chandran"],["Elena Duarte","elena.duarte"],["Jonah Reid","jonah.reid"]];
// A real funnel shape: most through, a few still moving, one waiting.
const STAGES = ["accepted","accepted","accepted","offer_sent","offer_sent","interview_completed",
                "interview_booked","submitted","waiting_list"];
const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();

const { data: centres } = await supabase.from("centers").select("id, name, currency").eq("is_demo", true);
const ny = centres.find((c) => /New York/.test(c.name));
const la = centres.find((c) => /Los Angeles/.test(c.name));
const { data: courses } = await supabase.from("courses").select("id, name, center_id").in("center_id", [ny.id, la.id]);

// The application form's own prompts. Ramy, 3 Sep 2026: "the recording part,
// the actual recording. I wanna be able to record myself." He couldn't -- the
// form only renders the recorder when the centre has an active speaking
// prompt, and BOTH demo centres had zero writing prompts and zero speaking
// prompts. So the only application form with a recorder on it was Elmswood's
// live one, which the journey rightly labels "look, don't submit".
//
// Seeded here rather than in a migration: a migration runs once and the next
// centre rebuild destroys what it wrote.
const WRITING = [
  ["narrative", "Describe a time you learned something difficult, and what actually helped."],
  ["descriptive", "Describe a teacher who taught you well, and what they actually did."],
  ["argumentative", "Can anyone learn a language as an adult? Take a position and defend it."],
];
const SPEAKING = [
  "Tell us about a time you had to adapt your communication style for a new audience.",
  "Describe how you would explain your job to a stranger.",
  "Talk about a meal you know how to cook well.",
];

let writingAdded = 0, speakingAdded = 0;
for (const centre of [ny, la]) {
  for (const [prompt_type, prompt_text] of WRITING) {
    const { data: exists } = await supabase
      .from("application_writing_prompts")
      .select("id").eq("center_id", centre.id).eq("prompt_text", prompt_text).maybeSingle();
    if (exists) continue;
    const { error } = await supabase
      .from("application_writing_prompts")
      .insert({ center_id: centre.id, prompt_type, prompt_text, active: true });
    if (error) console.warn("  writing prompt:", error.message); else writingAdded++;
  }
  for (const prompt_text of SPEAKING) {
    const { data: exists } = await supabase
      .from("speaking_task_prompts")
      .select("id").eq("center_id", centre.id).eq("prompt_text", prompt_text).maybeSingle();
    if (exists) continue;
    const { error } = await supabase
      .from("speaking_task_prompts")
      .insert({ center_id: centre.id, prompt_text, active: true });
    if (error) console.warn("  speaking prompt:", error.message); else speakingAdded++;
  }
}
console.log(`writing prompts added: ${writingAdded}   speaking prompts added: ${speakingAdded}`);

let added = 0, plans = 0, collected = 0;
for (const [centre, course, names] of [
  [ny, courses.find((c) => c.name === "CELTA Demo Course"), NY],
  [la, courses.find((c) => /Los Angeles/.test(c.name)), LA],
]) {
  for (let i = 0; i < names.length; i++) {
    const [full_name, slug] = names[i];
    const email = `${slug}@example.com`;
    const { data: exists } = await supabase.from("applicants").select("id").eq("email", email).eq("center_id", centre.id).maybeSingle();
    if (exists) continue;

    const daysAgo = 4 + i * 5;                 // arrivals spread over ~7 weeks
    const stage = STAGES[i % STAGES.length];
    const { data: applicant, error } = await supabase.from("applicants").insert({
      center_id: centre.id, intake_course_id: course.id, full_name, email, stage,
      language_awareness_submission: "", fee_paid: false, waiting_list_opt_out: false,
      notification_opt_outs: [], created_at: ago(daysAgo), updated_at: ago(daysAgo),
    }).select("id").single();
    if (error) { console.warn("  applicant:", full_name, error.message); continue; }
    added++;

    if (stage !== "accepted") continue;        // only those who accepted are paying
    const currency = centre.currency || "USD";
    const { data: plan } = await supabase.from("payment_plans").insert({
      center_id: centre.id, course_id: course.id, applicant_id: applicant.id,
      total_amount: 1800, currency, instalment_count: 3, created_at: ago(daysAgo),
    }).select("id").single();
    plans++;

    // Deposit and second instalment settled recently, so "collected this
    // month" stops reading zero; the third is still to come.
    for (const [instalment_index, amount, status, when] of [[1, 600, "paid", 40], [2, 600, "paid", 1], [3, 600, "pending", 0]]) {
      // paid_at, not created_at: every "collected this month" figure in the
      // app filters on paid_at, so a payment with status 'paid' and no
      // paid_at counts as nothing. That is why the first pass still read $0.
      await supabase.from("payments").insert({
        center_id: centre.id, payment_plan_id: plan.id, instalment_index,
        amount, currency, status, source: "manual", created_at: ago(when),
        paid_at: status === "paid" ? ago(when) : null,
      });
      if (status === "paid") collected += amount;
    }
  }
}
console.log(`applicants added: ${added}   payment plans: ${plans}   collected recently: ${collected}`);
