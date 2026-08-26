import { NextResponse } from "next/server";

export async function GET() {
  const now = new Date();
  return NextResponse.json({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    offsetMinutes: now.getTimezoneOffset(),
    isoUtc: now.toISOString(),
    localHours: now.getHours(),
    localDateSlice: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  });
}
