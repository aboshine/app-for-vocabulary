import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { lessonList, openLesson } from "@/lib/tutor-service";
import { readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The grammar syllabus with what is done and what comes next. */
export async function GET() {
  return NextResponse.json(await lessonList());
}

/** Open (and, the first time, write) the lesson for a pattern: body { key, regenerate? } */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const data = (body.ok ? body.data : {}) as { key?: unknown; regenerate?: unknown };
  try {
    return NextResponse.json(await openLesson(String(data.key ?? ""), data.regenerate === true));
  } catch (error) {
    return errorResponse(error);
  }
}
