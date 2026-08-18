import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { renderFormalLetterBuffer, type FormalLetterInput } from "@/lib/formal-letter-pdf/document";

// Renders the SNAPSHOT stored at issue time, not live data -- this is a
// filed written record (Admin Handbook 9.2 / 6.9 both cited in the source
// design), so it must read back exactly what was sent even if the
// underlying assignment/celta5/deferral record has changed since.
export async function GET(_request: Request, { params }: { params: Promise<{ letterId: string }> }) {
  const { letterId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  if (!viewer) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const supabase = await createClient();
  const { data: letter } = await supabase.from("formal_letters").select("*").eq("id", letterId).maybeSingle();
  if (!letter) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const isStaff = viewer.role === "trainer" || viewer.role === "admin";
  const isOwnLetter = viewer.id === letter.trainee_id;
  if (!isStaff && !isOwnLetter) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const buffer = await renderFormalLetterBuffer(letter.snapshot as unknown as FormalLetterInput);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${letter.letter_type}-letter.pdf"`,
    },
  });
}
