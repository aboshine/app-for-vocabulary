import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { addThemePack } from "@/lib/curriculum";
import { readJson } from "@/lib/validation";

/** Add the next words of a built-in theme: body { theme, count? } */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const data = (body.ok ? body.data : {}) as { theme?: unknown; count?: unknown };
  if (typeof data.theme !== "string") return NextResponse.json({ error: "Theme is required." }, { status: 400 });
  const count = Number(data.count);
  try {
    return NextResponse.json(
      await addThemePack(data.theme, Number.isInteger(count) && count > 0 && count <= 30 ? count : undefined),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
