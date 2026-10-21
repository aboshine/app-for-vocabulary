import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/ai/http";
import { validatePack } from "@/lib/ai/prompts";
import { addCustomWords } from "@/lib/curriculum";
import { getSettings } from "@/lib/settings";
import { readJson } from "@/lib/validation";

/** Save the AI words the user kept: body { topic, words: [...] } */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const data = (body.ok ? body.data : {}) as { topic?: unknown; words?: unknown };
  try {
    const words = validatePack({ words: data.words });
    const settings = await getSettings();
    return NextResponse.json(await addCustomWords({ topic: String(data.topic ?? ""), words, level: settings.level }));
  } catch (error) {
    return errorResponse(error);
  }
}
