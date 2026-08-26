import { NextResponse } from "next/server";

// Temporary diagnostic route -- checks whether OPENAI_API_KEY is set and
// valid without ever exposing the key itself or spending on a real
// completion. GET /v1/models is free and just validates the key.
export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ keySet: false, valid: false });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json({ keySet: true, valid: false, status: response.status, body: body.slice(0, 300) });
    }
    const data = (await response.json()) as { data?: { id: string }[] };
    const hasGpt4oMini = (data.data ?? []).some((m) => m.id === "gpt-4o-mini");
    return NextResponse.json({ keySet: true, valid: true, modelCount: data.data?.length ?? 0, hasGpt4oMini });
  } catch (err) {
    return NextResponse.json({ keySet: true, valid: false, error: String(err) });
  }
}
