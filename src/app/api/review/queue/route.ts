import { NextResponse } from "next/server";
import { getReviewQueue } from "@/lib/vocab-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const queue = await getReviewQueue();
  return NextResponse.json(queue);
}
