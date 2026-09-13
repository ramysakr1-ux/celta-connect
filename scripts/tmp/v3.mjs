import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const svc = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const admin = createClient(url, svc);
const { data: t } = await admin.from("assignment_templates").select("sections,center_id,assignment_type").eq("id","1b2ebc15-f0ee-474e-98cb-e7c0094978e6").single();
console.log("template last section:", t.sections[t.sections.length-1].title);

const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: "walk-trainer@celtaconnect.com" });
const user = createClient(url, anon);
await user.auth.verifyOtp({ email: "walk-trainer@celtaconnect.com", token: link.properties.email_otp, type: "magiclink" });
const { error } = await user.from("assignment_template_versions").insert({
  template_id: "1b2ebc15-f0ee-474e-98cb-e7c0094978e6",
  center_id: t.center_id, assignment_type: t.assignment_type, version: 99,
  sections: t.sections, format: "prose",
});
console.log("insert as trainer:", error ? "REFUSED -- " + error.message : "allowed (cleaning up)");
if (!error) await admin.from("assignment_template_versions").delete().eq("version", 99);
