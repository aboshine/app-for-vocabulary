import { NextResponse } from "next/server";
import { getReviewQueue } from "@/lib/vocab-service";

export async function GET() {
  const queue = await getReviewQueue();
  return NextResponse.json(queue);
}
