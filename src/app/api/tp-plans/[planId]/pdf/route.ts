import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { renderTpPdfBuffer } from "@/lib/tp-pdf/document";

// Auth is deliberately just "can this session's RLS-scoped client read this
// row" -- trainee-owns-it and trainer/admin-in-course are already encoded
// as Postgres policies (migration 0022), so there's no separate permission
// check to duplicate here. A row that doesn't come back is a 404, not a
// 403, to the caller either way.
export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const supabase = await createClient();

  const { data: plan } = await supabase.from("tp_plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!plan.submitted_at) {
    return NextResponse.json({ error: "This lesson plan hasn't been submitted yet." }, { status: 409 });
  }

  const [{ data: trainee }, { data: languageAnalysis }, { data: materials }, { data: selfEvaluation }, { data: feedback }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", plan.trainee_id).maybeSingle(),
      supabase.from("tp_language_analyses").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
      supabase.from("tp_materials").select("*").eq("tp_plan_id", plan.id).order("created_at"),
      supabase.from("tp_self_evaluations").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
      supabase.from("tp_feedback").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
    ]);

  if (!selfEvaluation?.submitted_at) {
    return NextResponse.json({ error: "The self-evaluation hasn't been submitted yet." }, { status: 409 });
  }
  if (!feedback?.submitted_at) {
    return NextResponse.json({ error: "The tutor feedback hasn't been submitted yet." }, { status: 409 });
  }

  const baseBuffer = await renderTpPdfBuffer({
    traineeName: trainee?.full_name ?? "Trainee",
    tpNumber: plan.tp_number,
    plan,
    languageAnalysis: languageAnalysis ?? null,
    selfEvaluation,
    feedback,
  });

  const merged = await PDFDocument.load(baseBuffer);

  for (const material of materials ?? []) {
    if (!material.storage_path) continue;
    const { data: fileBlob } = await supabase.storage.from("tp-materials").download(material.storage_path);
    if (!fileBlob) continue;
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());

    if (material.file_type === "pdf") {
      const materialDoc = await PDFDocument.load(bytes).catch(() => null);
      if (!materialDoc) continue;
      const pages = await merged.copyPages(materialDoc, materialDoc.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    } else if (material.file_type === "image") {
      const isPng = (material.file_name ?? "").toLowerCase().endsWith(".png");
      const image = await (isPng ? merged.embedPng(bytes) : merged.embedJpg(bytes)).catch(() => null);
      if (!image) continue;
      const page = merged.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
  }

  const finalBytes = await merged.save();

  return new NextResponse(Buffer.from(finalBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="TP${plan.tp_number}-${(trainee?.full_name ?? "trainee").replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
