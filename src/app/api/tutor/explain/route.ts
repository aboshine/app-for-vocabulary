import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { explainText } from "@/lib/tutor-service";
import { readJson } from "@/lib/validation";

export const maxDuration = 60;

/** Break a Korean sentence or short text down: body { text } */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const text = body.ok ? String((body.data as { text?: unknown })?.text ?? "") : "";
  try {
    return NextResponse.json(await explainText(text));
  } catch (error) {
    return errorResponse(error);
  }
}
