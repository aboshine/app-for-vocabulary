import { NextRequest, NextResponse } from "next/server";
import { getReviewPool } from "@/lib/vocab-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get("categoryId") ?? undefined;
  const pool = await getReviewPool(categoryId || undefined);
  return NextResponse.json(pool);
}
