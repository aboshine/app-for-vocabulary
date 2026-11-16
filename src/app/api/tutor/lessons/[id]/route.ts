import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { completeLesson, getLesson } from "@/lib/tutor-service";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await getLesson(id);
  if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  return NextResponse.json(lesson);
}

/** Finish the lesson; it becomes a grammar card. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await completeLesson(id));
  } catch (error) {
    return errorResponse(error);
  }
}
