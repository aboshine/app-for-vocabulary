import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { connectTelegram, disconnectTelegram, setReminders, telegramStatus } from "@/lib/telegram";
import { readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await telegramStatus());
}

/** body { action: "connect" | "disconnect" | "on" | "off" } */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const action = body.ok ? (body.data as { action?: unknown })?.action : null;
  try {
    if (action === "connect") return NextResponse.json(await connectTelegram());
    if (action === "disconnect") return NextResponse.json(await disconnectTelegram());
    if (action === "on" || action === "off") return NextResponse.json(await setReminders(action === "on"));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
