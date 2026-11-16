import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { checkWriting, writingTask } from "@/lib/practice-service";
import { readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Today's writing task: a few words to use. */
export async function GET() {
  return NextResponse.json(await writingTask());
}

/** Hand in sentences for correction: body { text, wordIds, grammar? } */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const data = (body.ok ? body.data : {}) as { text?: unknown; wordIds?: unknown; grammar?: unknown };
  try {
    return NextResponse.json(
      await checkWriting({
        text: String(data.text ?? ""),
        wordIds: Array.isArray(data.wordIds) ? data.wordIds.filter((id): id is string => typeof id === "string") : [],
        grammar: String(data.grammar ?? ""),
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
