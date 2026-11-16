import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { startWeekly, weeklyState } from "@/lib/weekly-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await weeklyState());
}

/** Start the weekly check (or continue the unfinished one). */
export async function POST() {
  try {
    return NextResponse.json(await startWeekly(), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
