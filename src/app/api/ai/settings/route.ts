import { NextRequest, NextResponse } from "next/server";
import { getAiSettings, updateAiSettings } from "@/lib/ai-settings";
import { readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getAiSettings());
}

export async function PATCH(request: NextRequest) {
  const body = await readJson(request);
  if (!body.ok || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  return NextResponse.json(await updateAiSettings(body.data as Record<string, unknown>));
}
