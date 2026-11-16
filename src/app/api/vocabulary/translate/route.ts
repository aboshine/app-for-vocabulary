import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { translateBatch, translateStatus } from "@/lib/practice-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** How many cards still have a meaning in another language. */
export async function GET() {
  return NextResponse.json(await translateStatus());
}

/** Translate the next batch of cards into the current explanation language. */
export async function POST() {
  try {
    return NextResponse.json(await translateBatch());
  } catch (error) {
    return errorResponse(error);
  }
}
