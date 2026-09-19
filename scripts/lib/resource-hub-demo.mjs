// The demo centre's Resource Hub library, and its admin chat room.
//
// The demo centre carried three resources: no Cambridge documents ("Not
// uploaded" in all four named slots), no reading list, nothing under Forms
// and Documents -- the 26 Aug 2026 uploads live on Elmswood's centre, not
// this one. Ramy, 20 Sep 2026: seed them. The Cambridge files are COPIED
// object-by-object from Elmswood's storage folder into the demo centre's
// own (the bucket is shared; the folder is the centre), so the demo does
// not depend on Elmswood keeping them. A missing source is warned about,
// not fatal.
//
// Also the centre admin chat room: getAdminChatRooms() creates it on first
// visit through the admin client, which the demo write-block refuses for a
// demo viewer -- so the room never existed and the chat pill never showed
// on the demo's Centre Management (Ramy, 20 Sep 2026).

const SOURCE_CENTER = "c2086317-88a9-4286-9c30-bb04dc9740d6"; // Elmswood English Centre
const BUCKET = "resource-hub-files";

// Title -> which named slot it also answers (src/lib/cambridge-documents.ts).
const SLOT_BY_TITLE = {
  "CELTA Syllabus and Assessment Guidelines (Dec 2022)": "syllabus",
  "CELTA Administration Handbook (June 2025)": "admin_handbook",
};

const READING = [
  { title: "Scrivener, J. -- Learning Teaching (3rd ed.)", description: "The course's core methodology text. Chapters 1-6 before day one if you can; the classroom management and lesson planning chapters again in week 1.", url: "https://www.macmillanenglish.com/catalogue/methodology/learning-teaching" },
  { title: "Harmer, J. -- The Practice of English Language Teaching (5th ed.)", description: "The reference we cite most in feedback. Use the index -- nobody reads it cover to cover on a CELTA.", url: "https://www.pearsonelt.com/catalogue/methodology/the-practice-of-english-language-teaching.html" },
  { title: "Thornbury, S. -- About Language (2nd ed.)", description: "Language awareness tasks with keys. Work through the verb-form and pronunciation sections before the Language Related Tasks assignment.", url: "https://www.cambridge.org/elt/about-language" },
  { title: "Swan, M. -- Practical English Usage (4th ed.)", description: "The grammar reference for your language analysis sheets. Cite it by entry number.", url: "https://elt.oup.com/catalogue/items/global/grammar_vocabulary/practical_english_usage_4th_edition" },
  { title: "Parrott, M. -- Grammar for English Language Teachers (2nd ed.)", description: "Anticipated problems, by structure. The 'typical difficulties for learners' sections are exactly what your plan needs.", url: "https://www.cambridge.org/elt/grammar-for-english-language-teachers" },
  { title: "Ur, P. -- A Course in English Language Teaching (2nd ed.)", description: "Short, practical, with tasks. Good for the Lessons from the Classroom assignment when you need a name for something you already do.", url: "https://www.cambridge.org/elt/a-course-in-english-language-teaching" },
];

export async function seedResourceHubDemo(supabase, { centerId, uploadedBy, nowIso }) {
  const out = { copied: 0, skipped: 0, reading: 0, slots: 0, adminRoom: false };
  // 1. Cambridge documents: Elmswood's Forms shelf, copied file by file.
  const { data: source } = await supabase
    .from("resources")
    .select("title, description, resource_type, visible_to_trainee, content_type, storage_path, file_url, category")
    .eq("center_id", SOURCE_CENTER)
    .eq("category", "forms")
    .order("created_at");
  for (const r of source ?? []) {
    if (!r.storage_path) { out.skipped += 1; continue; }
    const target = r.storage_path.replace(SOURCE_CENTER, centerId);
    const { error: copyErr } = await supabase.storage.from(BUCKET).copy(r.storage_path, target);
    if (copyErr && !/already exists|Duplicate/i.test(copyErr.message)) { console.warn(`  resource hub: could not copy "${r.title}": ${copyErr.message}`); out.skipped += 1; continue; }
    const { error } = await supabase.from("resources").insert({
      center_id: centerId,
      title: r.title,
      description: r.description,
      category: "forms",
      resource_type: r.resource_type,
      visible_to_trainee: r.visible_to_trainee,
      content_type: r.content_type,
      storage_path: target,
      file_url: r.file_url ?? target,
      uploaded_by: uploadedBy,
      created_at: nowIso,
    });
    if (error) { console.warn(`  resource hub: "${r.title}": ${error.message}`); out.skipped += 1; continue; }
    out.copied += 1;
    const slot = SLOT_BY_TITLE[r.title];
    if (slot) {
      const { error: slotErr } = await supabase.from("cambridge_documents").insert({ center_id: centerId, doc_type: slot, storage_path: target, file_url: r.file_url ?? target, uploaded_by: uploadedBy });
      if (slotErr) console.warn(`  cambridge slot ${slot}: ${slotErr.message}`); else out.slots += 1;
    }
  }
  // 2. The reading list: links, not files.
  const { error: readErr } = await supabase.from("resources").insert(
    READING.map((b, i) => ({ center_id: centerId, title: b.title, description: b.description, category: "reading", resource_type: "reading", content_type: "link", file_url: b.url, visible_to_trainee: true, uploaded_by: uploadedBy, created_at: new Date(new Date(nowIso).getTime() + i * 1000).toISOString() }))
  );
  if (readErr) console.warn("  reading list:", readErr.message); else out.reading = READING.length;
  // 3. The centre admin chat room, with every admin-family person at the centre in it.
  const { data: centre } = await supabase.from("centers").select("name").eq("id", centerId).single();
  const { data: existing } = await supabase.from("staff_channels").select("id").eq("center_id", centerId).eq("type", "centre_admin").maybeSingle();
  let channelId = existing?.id ?? null;
  if (!channelId) {
    const { data: created, error: chErr } = await supabase.from("staff_channels").insert({ center_id: centerId, type: "centre_admin", name: `${centre.name} · admin` }).select("id").single();
    if (chErr) console.warn("  admin room:", chErr.message); else channelId = created.id;
  }
  if (channelId) {
    const { data: admins } = await supabase.from("profiles").select("id").eq("center_id", centerId).in("role", ["admin", "platform_owner"]);
    if ((admins ?? []).length > 0) {
      const { error: memErr } = await supabase.from("staff_channel_members").upsert(admins.map((a) => ({ channel_id: channelId, profile_id: a.id })), { onConflict: "channel_id,profile_id" });
      if (memErr) console.warn("  admin room members:", memErr.message); else out.adminRoom = true;
    }
  }
  return out;
}
