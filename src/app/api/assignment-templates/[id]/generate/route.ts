import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { generateAssignmentTemplateSections } from "@/lib/assignment-templates/generate";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentProfile();
  if (!session?.profile || (session.profile.role !== "trainer" && session.profile.role !== "admin")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;

  // generateAssignmentTemplateSections uses the service-role client
  // internally, so this route checks center ownership itself via the
  // caller's own RLS-scoped client first -- same reasoning as
  // /api/coursebooks/[id]/generate.
  const supabase = await createClient();
  const { data: template } = await supabase
    .from("assignment_templates")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!template) {
    return NextResponse.json({ error: "Assignment template not found" }, { status: 404 });
  }

  try {
    await generateAssignmentTemplateSections(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
