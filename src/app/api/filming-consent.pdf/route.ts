import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { renderFilmingConsentBuffer } from "@/lib/filming-consent-pdf/document";

// Generic centre template -- no per-course/per-trainee data, so this is a
// static render behind the same trainer/admin gate as every other internal
// Cambridge-facing document, not a public download.
export async function GET() {
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  if (!viewer || (viewer.role !== "trainer" && viewer.role !== "admin")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const buffer = await renderFilmingConsentBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Filming-Consent-Template.pdf"`,
    },
  });
}
