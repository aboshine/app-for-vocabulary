import { NextRequest, NextResponse } from "next/server";
import { getPlan } from "@/lib/plan-service";
import { sendReminder, type ReminderKind } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Called by Vercel Cron (see vercel.json). When CRON_SECRET is set, Vercel sends it
 * as a Bearer token and anything else is rejected.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const kind: ReminderKind = request.nextUrl.searchParams.get("kind") === "evening" ? "evening" : "morning";
  try {
    return NextResponse.json({ kind, ...(await sendReminder(kind, await getPlan())) });
  } catch (error) {
    return NextResponse.json({ kind, sent: false, reason: error instanceof Error ? error.message : "failed" }, { status: 502 });
  }
}
