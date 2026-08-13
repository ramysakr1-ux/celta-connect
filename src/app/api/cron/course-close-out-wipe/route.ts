import { NextResponse } from "next/server";
import { runDueCloseOutWipes } from "@/lib/course-close-out/wipe";

// Vercel Cron hits this once a day (vercel.json). Vercel signs cron
// requests with this same secret in the Authorization header -- checking it
// is the only thing standing between this route and anyone on the internet
// triggering a real candidate-data erasure, so it's not optional even
// though the route itself does nothing without a due grace_period row.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const result = await runDueCloseOutWipes();
  return NextResponse.json(result);
}
