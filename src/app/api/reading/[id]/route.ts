import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { completeReading, readingView } from "@/lib/reading";
import { RATINGS, type Rating } from "@/lib/srs";
import { readJson } from "@/lib/validation";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await readingView(id);
  if (!view) return NextResponse.json({ error: "Text not found." }, { status: 404 });
  return NextResponse.json(view);
}

/** Finish reading: body { results: [{ vocabularyId, rating }] } */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request);
  const raw = body.ok ? (body.data as { results?: unknown })?.results : null;
  if (!Array.isArray(raw)) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  const results = raw
    .map((item) => item as { vocabularyId?: unknown; rating?: unknown })
    .filter((item) => typeof item.vocabularyId === "string" && RATINGS.includes(item.rating as Rating))
    .map((item) => ({ vocabularyId: item.vocabularyId as string, rating: item.rating as Rating }));
  try {
    return NextResponse.json(await completeReading(id, results));
  } catch (error) {
    return errorResponse(error);
  }
}
