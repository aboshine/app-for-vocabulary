import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { readJson } from "@/lib/validation";
import { submitWeekly } from "@/lib/weekly-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Hand in the check: body { answers: string[] } in question order. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request);
  const raw = body.ok ? (body.data as { answers?: unknown })?.answers : null;
  if (!Array.isArray(raw)) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  try {
    return NextResponse.json(await submitWeekly(id, raw.map((a) => String(a ?? "").slice(0, 200))));
  } catch (error) {
    return errorResponse(error);
  }
}
