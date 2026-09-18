import { NextRequest, NextResponse } from "next/server";
import { submitGrammarReview } from "@/lib/grammar-service";
import { RATINGS, type Rating } from "@/lib/srs";
import { readJson } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  const data = body.data as { grammarId?: unknown; rating?: unknown };
  if (typeof data.grammarId !== "string" || !RATINGS.includes(data.rating as Rating)) {
    return NextResponse.json({ error: "Invalid review payload." }, { status: 400 });
  }
  try {
    const updated = await submitGrammarReview({
      grammarId: data.grammarId,
      rating: data.rating as Rating,
    });
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review failed";
    const status = message === "Grammar not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
