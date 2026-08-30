import { createAdminClient } from "@/lib/supabase/admin";
import { createZip, safeZipName, type ZipEntry } from "@/lib/zip";

// "Download all my materials" used to be <a href="#classes"> -- it scrolled
// the page to the class list and nothing else. Ramy, 30 Aug 2026: "download
// all materials doesn't really do anything."
//
// It matters more than a dead link usually would, because the sentence
// directly above it is the one telling the volunteer their link stops
// working when the course ends and to download anything they want to keep.
// Offering "download all" under that promise and then not delivering it is
// how somebody loses their materials.
//
// So it is a real archive now. Same token proof as every other volunteer
// path -- there is no session on this route at all, the token IS the
// identity -- and the same admin-signed storage reads the page itself uses,
// since a volunteer could never sign a storage URL themselves.

// file_name is a human title -- "Present perfect -- slides" -- and carries
// no extension; the real one lives on storage_path (and file_type). On the
// page that never showed, because a signed URL serves its own content type
// and the browser opens it regardless. Inside a zip it matters completely:
// an extensionless file lands on the desktop as something no OS will open
// by double-click, which would have made a working archive useless anyway.
function withExtension(name: string, storagePath: string | null, fileType: string | null): string {
  if (/\.[a-z0-9]{2,5}$/i.test(name)) return name;
  const fromPath = storagePath?.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  const ext = fromPath ?? (fileType && /^[a-z0-9]{2,5}$/i.test(fileType) ? fileType : null);
  return ext ? `${name}.${ext.toLowerCase()}` : name;
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("volunteer_student_id, course_id, expires_at")
    .eq("token", token)
    .eq("role", "volunteer_student")
    .maybeSingle();

  if (!accessToken?.volunteer_student_id || new Date(accessToken.expires_at) < new Date()) {
    return new Response("This link has expired.", { status: 403 });
  }

  const [{ data: course }, { data: shared }, { data: otherEvents }] = await Promise.all([
    admin.from("courses").select("name").eq("id", accessToken.course_id).maybeSingle(),
    admin
      .from("volunteer_shared_materials")
      .select("created_at, tp_materials(file_name, file_type, slides_url, storage_path, tp_plans(tp_number))")
      .eq("course_id", accessToken.course_id)
      .order("created_at", { ascending: false }),
    admin
      .from("course_timetable_events")
      .select("id, title")
      .eq("course_id", accessToken.course_id)
      .neq("type", "tp"),
  ]);

  const otherEventIds = (otherEvents ?? []).map((e) => e.id);
  const { data: sessionRows } = otherEventIds.length
    ? await admin
        .from("session_materials")
        .select("timetable_event_id, storage_path, file_name, file_type, slides_url, created_at")
        .in("timetable_event_id", otherEventIds)
    : { data: [] };
  const eventTitleById = new Map((otherEvents ?? []).map((e) => [e.id, e.title]));

  // Everything the volunteer can see, flattened to "which folder, what
  // file" -- teaching practice grouped by TP number, other sessions by the
  // event's own title, exactly as the page groups them on screen.
  const wanted: { folder: string; fileName: string; fileType: string | null; storagePath: string | null; slidesUrl: string | null; modified: string | null }[] = [];

  for (const row of shared ?? []) {
    const m = row.tp_materials as unknown as {
      file_name: string | null;
      file_type: string | null;
      slides_url: string | null;
      storage_path: string | null;
      tp_plans: { tp_number: number } | null;
    } | null;
    if (!m) continue;
    wanted.push({
      folder: m.tp_plans?.tp_number != null ? `TP${m.tp_plans.tp_number}` : "Teaching practice",
      fileName: m.file_name ?? "Material",
      fileType: m.file_type,
      storagePath: m.storage_path,
      slidesUrl: m.slides_url,
      modified: row.created_at,
    });
  }

  for (const m of sessionRows ?? []) {
    wanted.push({
      folder: safeZipName(eventTitleById.get(m.timetable_event_id) ?? "Sessions", "Sessions"),
      fileName: m.file_name ?? "Material",
      fileType: m.file_type,
      storagePath: m.storage_path,
      slidesUrl: m.slides_url,
      modified: m.created_at,
    });
  }

  const entries: ZipEntry[] = [];
  const links: string[] = [];
  const failed: string[] = [];
  // Names repeat across a course -- two tutors both share "handout.pdf" --
  // and a zip with two identical paths extracts to one file silently.
  const usedNames = new Set<string>();

  const downloaded = await Promise.all(
    wanted.map(async (w) => {
      if (!w.storagePath) return { w, bytes: null };
      const { data, error } = await admin.storage.from("tp-materials").download(w.storagePath);
      if (error || !data) return { w, bytes: null };
      return { w, bytes: new Uint8Array(await data.arrayBuffer()) };
    })
  );

  for (const { w, bytes } of downloaded) {
    if (!bytes) {
      // A slides_url material is a link to someone else's service, not a
      // file we hold -- it belongs in the index, not as a broken entry.
      if (w.slidesUrl) links.push(`${w.folder}/${w.fileName}\n  ${w.slidesUrl}`);
      else failed.push(`${w.folder}/${w.fileName}`);
      continue;
    }
    let name = `${w.folder}/${withExtension(safeZipName(w.fileName, "Material"), w.storagePath, w.fileType)}`;
    if (usedNames.has(name)) {
      const dot = name.lastIndexOf(".");
      let n = 2;
      let candidate = name;
      while (usedNames.has(candidate)) {
        candidate = dot > name.lastIndexOf("/") ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
        n++;
      }
      name = candidate;
    }
    usedNames.add(name);
    entries.push({ name, data: bytes, modified: w.modified ? new Date(w.modified) : undefined });
  }

  if (entries.length === 0 && links.length === 0) {
    return new Response("There are no materials shared with you yet.", { status: 404 });
  }

  if (links.length > 0 || failed.length > 0) {
    const lines = ["Some of your materials live on other services and are links rather than files.", ""];
    if (links.length > 0) lines.push(...links, "");
    if (failed.length > 0) lines.push("These could not be included -- ask your teacher to share them again:", ...failed.map((f) => `  ${f}`));
    entries.push({ name: "Links.txt", data: new TextEncoder().encode(lines.join("\n")) });
  }

  const zip = createZip(entries, new Date());
  const archiveName = safeZipName(`${course?.name ?? "Course"} materials.zip`, "materials.zip");

  return new Response(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(zip.length),
      "Content-Disposition": `attachment; filename="${archiveName}"`,
      // A volunteer's set changes whenever a tutor shares something new.
      "Cache-Control": "no-store",
    },
  });
}
