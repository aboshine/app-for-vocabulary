import { NextResponse } from "next/server";
import { probeModels } from "@/lib/ai/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Time a tiny question on each configured Gemini model (Settings → "Test AI speed"). */
export async function GET() {
  return NextResponse.json(await probeModels());
}
