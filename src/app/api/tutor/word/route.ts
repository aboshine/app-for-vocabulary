import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { wordHelp } from "@/lib/tutor-service";
import { readJson } from "@/lib/validation";

export const maxDuration = 60;

/** Memory help for one word: body { vocabularyId } */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const id = body.ok ? String((body.data as { vocabularyId?: unknown })?.vocabularyId ?? "") : "";
  if (!id) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  try {
    return NextResponse.json(await wordHelp(id));
  } catch (error) {
    return errorResponse(error);
  }
}
