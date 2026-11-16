import { NextRequest, NextResponse } from "next/server";
import { getPlan, setDailyMinutes } from "@/lib/plan-service";
import { readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Today's plan: streak, steps, weak words. */
export async function GET() {
  return NextResponse.json(await getPlan());
}

/** Change the daily time budget: body { dailyMinutes: 15 | 25 | 40 } */
export async function PATCH(request: NextRequest) {
  const body = await readJson(request);
  const minutes = body.ok ? (body.data as { dailyMinutes?: unknown })?.dailyMinutes : undefined;
  if (minutes === undefined) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  await setDailyMinutes(minutes);
  return NextResponse.json(await getPlan());
}
