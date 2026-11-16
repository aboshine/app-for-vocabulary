import { NextRequest, NextResponse } from "next/server";
import { weakWords } from "@/lib/plan-service";
import { getReviewPool } from "@/lib/vocab-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // ?weak=1: the words the learner keeps forgetting, due or not
  if (request.nextUrl.searchParams.get("weak") === "1") return NextResponse.json(await weakWords(20));
  const categoryId = request.nextUrl.searchParams.get("categoryId") ?? undefined;
  const pool = await getReviewPool(categoryId || undefined);
  return NextResponse.json(pool);
}
