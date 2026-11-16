import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { listeningWords, recordListening } from "@/lib/practice-service";
import { readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Words for one listening round. */
export async function GET() {
  return NextResponse.json(await listeningWords());
}

/** One answer: body { vocabularyId, correct } */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const data = (body.ok ? body.data : {}) as { vocabularyId?: unknown; correct?: unknown };
  if (typeof data.vocabularyId !== "string" || typeof data.correct !== "boolean") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  try {
    return NextResponse.json(await recordListening(data.vocabularyId, data.correct));
  } catch (error) {
    return errorResponse(error);
  }
}
