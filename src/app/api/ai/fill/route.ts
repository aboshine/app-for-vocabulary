import { NextRequest, NextResponse } from "next/server";
import { generateJson } from "@/lib/ai/client";
import { errorResponse } from "@/lib/ai/http";
import { fillNotes, fillPrompt, validateFill } from "@/lib/ai/prompts";
import { getAiSettings as getSettings } from "@/lib/ai-settings";
import { readJson } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const korean = body.ok ? String((body.data as { korean?: unknown })?.korean ?? "").trim().slice(0, 100) : "";
  if (!korean) return NextResponse.json({ error: "Type the Korean word first." }, { status: 400 });
  try {
    const settings = await getSettings();
    const { system, prompt } = fillPrompt(korean, settings.level, settings.lang);
    const { data } = await generateJson({ system, prompt, tier: "fast", temperature: 0.3, maxOutputTokens: 1500 }, validateFill);
    return NextResponse.json({
      meaning: data.meaning,
      exampleSentence: data.exampleSentence,
      exampleTranslation: data.exampleTranslation,
      notes: fillNotes(data),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
