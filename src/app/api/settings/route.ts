import { NextRequest, NextResponse } from "next/server";
import { parseSettingsInput } from "@/lib/settings";
import { countNewIntroducedToday, getSettings, saveSettings } from "@/lib/settings-service";
import { readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [settings, newIntroducedToday] = await Promise.all([getSettings(), countNewIntroducedToday()]);
  return NextResponse.json({ ...settings, newIntroducedToday });
}

export async function PUT(request: NextRequest) {
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  const parsed = parseSettingsInput(body.data);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }
  const saved = await saveSettings(parsed);
  const newIntroducedToday = await countNewIntroducedToday();
  return NextResponse.json({ ...saved, newIntroducedToday });
}
