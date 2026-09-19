import { NextRequest, NextResponse } from "next/server";
import { DIRECTIONS, RATINGS, type Rating, type ReviewDirection } from "@/lib/srs";
import { readJson } from "@/lib/validation";
import { submitReview } from "@/lib/vocab-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  const data = body.data as { vocabularyId?: unknown; rating?: unknown; direction?: unknown };
  if (
    typeof data.vocabularyId !== "string" ||
    !RATINGS.includes(data.rating as Rating) ||
    !DIRECTIONS.includes(data.direction as ReviewDirection)
  ) {
    return NextResponse.json({ error: "Invalid review payload." }, { status: 400 });
  }
  try {
    const updated = await submitReview({
      vocabularyId: data.vocabularyId,
      rating: data.rating as Rating,
      direction: data.direction as ReviewDirection,
    });
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review failed";
    const status = message === "Word not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
