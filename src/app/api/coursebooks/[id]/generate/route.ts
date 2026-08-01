import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { generateTpPointsForCoursebook } from "@/lib/tp-library/generate";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentProfile();
  if (!session?.profile || (session.profile.role !== "trainer" && session.profile.role !== "admin")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;

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

  try {
    await generateTpPointsForCoursebook(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
