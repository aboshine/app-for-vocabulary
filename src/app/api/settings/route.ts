import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { readJson } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PATCH(request: NextRequest) {
  const body = await readJson(request);
  if (!body.ok || !body.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  return NextResponse.json(await updateSettings(body.data as Record<string, unknown>));
}
