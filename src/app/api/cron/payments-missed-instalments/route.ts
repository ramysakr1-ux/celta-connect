import { NextResponse } from "next/server";
import { runMissedInstalmentsCron } from "@/lib/payments-cron";

// Same CRON_SECRET-bearer pattern as every other cron route in this app.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const result = await runMissedInstalmentsCron();
  return NextResponse.json(result);
}
