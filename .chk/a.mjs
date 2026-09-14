import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());

const { data: ir } = await db.from("interview_records").select("identity_checked_at,identity_document_type");
const idChecked = (ir ?? []).filter(r => r.identity_checked_at);
console.log("GUARD  identity checked without a document type:",
  idChecked.filter(r => !r.identity_document_type).length, "/", idChecked.length);

const { data: ap } = await db.from("applicants")
  .select("id,full_name,stage,intake_course_id,acknowledged_no_guarantee_at,acknowledged_no_exemptions_at,acknowledged_full_attendance_at,acknowledged_mixed_mode_demand_at,commitments_accepted_at");
const { data: cs } = await db.from("courses").select("id,delivery_mode");
const modeOf = new Map((cs ?? []).map(c => [c.id, c.delivery_mode]));
const mixed = (ap ?? []).filter(a => modeOf.get(a.intake_course_id) === "mixed");
console.log("GUARD  mixed-mode applicant without the demand acknowledgement:",
  mixed.filter(a => !a.acknowledged_mixed_mode_demand_at).length, "/", mixed.length);

console.log("\nThe four things an applicant acknowledges, across", ap.length, "applicants:");
for (const k of ["acknowledged_no_guarantee_at","acknowledged_no_exemptions_at","acknowledged_full_attendance_at","acknowledged_mixed_mode_demand_at","commitments_accepted_at"])
  console.log("  ", k.padEnd(38), (ap ?? []).filter(a => a[k]).length, "recorded");
