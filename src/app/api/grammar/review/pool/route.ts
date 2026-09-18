import { NextRequest, NextResponse } from "next/server";
import { getGrammarReviewPool } from "@/lib/grammar-service";

export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get("categoryId") ?? undefined;
  const pool = await getGrammarReviewPool(categoryId || undefined);
  return NextResponse.json(pool);
}
