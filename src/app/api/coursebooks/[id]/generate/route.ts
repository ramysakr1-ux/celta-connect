import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { generateTpPointsForCoursebook } from "@/lib/tp-library/generate";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentProfile();
  if (!session?.profile || (session.profile.role !== "trainer" && session.profile.role !== "admin")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { avoidRepeatOfIds?: unknown };
  const requestedAvoidIds = Array.isArray(body.avoidRepeatOfIds)
    ? body.avoidRepeatOfIds.filter((v): v is string => typeof v === "string")
    : [];

  // generateTpPointsForCoursebook uses the service-role client internally
  // (it needs to download the PDF from Storage and write pending_review
  // rows regardless of the caller's own RLS grants), so this route must
  // check center ownership itself via the caller's own RLS-scoped client
  // -- otherwise any trainer/admin could trigger generation on another
  // center's coursebook just by guessing/enumerating an id.
  const supabase = await createClient();
  const { data: coursebook } = await supabase
    .from("tp_coursebooks")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!coursebook) {
    return NextResponse.json({ error: "Coursebook not found" }, { status: 404 });
  }

  // Same reasoning for avoid-repeat ids: only include ones the caller's own
  // RLS-scoped client can actually see (same center), so a trainer can't
  // feed another center's tp_points content into this generation's prompt.
  let avoidRepeatOfIds: string[] = [];
  if (requestedAvoidIds.length > 0) {
    const { data: verifiedSiblings } = await supabase
      .from("tp_coursebooks")
      .select("id")
      .in("id", requestedAvoidIds);
    avoidRepeatOfIds = (verifiedSiblings ?? []).map((c) => c.id);
  }

  try {
    await generateTpPointsForCoursebook(id, avoidRepeatOfIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
