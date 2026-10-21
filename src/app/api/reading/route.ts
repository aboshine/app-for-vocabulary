import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { generateReading, listReadings, readingView, todaysReadingId } from "@/lib/reading";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Today's text (if any) plus the history list. */
export async function GET() {
  const [todayId, history] = await Promise.all([todaysReadingId(), listReadings()]);
  return NextResponse.json({ today: todayId ? await readingView(todayId) : null, history });
}

/** Generate a new text for today (also used for "another text"). */
export async function POST() {
  try {
    const id = await generateReading();
    return NextResponse.json(await readingView(id), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
