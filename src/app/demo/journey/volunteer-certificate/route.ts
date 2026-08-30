import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderCertificateBuffer } from "@/lib/certificate-pdf/document";

// The certificate of attendance, rendered so it can actually be seen.
//
// Ramy, 30 Aug 2026: "I want a view of the participation certificate as
// well." It existed as a component and nothing rendered it -- no route
// imported it, so the only way to know what it looked like was to read the
// JSX.
//
// It is still DESIGN-ONLY, and the journey page says so in as many words.
// Its own note is explicit: the cross-course sets/level-tracking that would
// decide a volunteer has completed a level does not exist, so there is no
// DB row to render from. This route feeds it plain sample input, exactly as
// the component was always designed to take -- it demonstrates the
// document, it does not claim the trigger is built.
//
// Real centre name and logo where we have one, so what is shown carries the
// centre's own branding rather than a placeholder. Per specs/README.md's
// "whose brand appears where": this is a document that leaves the system,
// so it is the centre's brand only, never the Connect mark.
export async function GET() {
  const admin = createAdminClient();
  const { data: centre } = await admin
    .from("centers")
    .select("name, logo_url")
    .eq("is_demo", true)
    .maybeSingle();

  const pdf = await renderCertificateBuffer({
    volunteerName: "Grace Adeyemi",
    levelName: "Elementary (A2)",
    centerName: centre?.name ?? "CELTA Demo Centre",
    centerLogoUrl: (centre as { logo_url?: string | null } | null)?.logo_url ?? null,
    completionDate: new Date().toISOString(),
    signatories: [
      { name: "Elif Yilmaz", role: "Main Course Tutor" },
      { name: "Jordan Blake", role: "Centre Director" },
    ],
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="certificate-of-attendance.pdf"',
    },
  });
}
