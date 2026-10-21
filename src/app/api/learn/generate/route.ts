import { NextRequest, NextResponse } from "next/server";
import { findTheme } from "@/data/curriculum";
import { generateJson } from "@/lib/ai/client";
import { errorResponse } from "@/lib/ai/http";
import { packPrompt, validatePack } from "@/lib/ai/prompts";
import { deckKoreanList, normalizeKorean } from "@/lib/curriculum";
import { getSettings } from "@/lib/settings";
import { readJson } from "@/lib/validation";

export const maxDuration = 60;

/** Ask the AI for new words on a theme key or free-text topic. Returns a preview; nothing is saved. */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const data = (body.ok ? body.data : {}) as { topic?: unknown; count?: unknown };
  const topicInput = String(data.topic ?? "").trim().slice(0, 120);
  if (!topicInput) return NextResponse.json({ error: "Write a topic first." }, { status: 400 });
  const count = Math.min(25, Math.max(5, Number(data.count) || 12));
  try {
    const settings = await getSettings();
    const theme = findTheme(topicInput);
    const exclude = await deckKoreanList();
    const { system, prompt } = packPrompt({
      topic: theme ? `${theme.titleKo} (${theme.topic})` : topicInput,
      level: settings.level,
      lang: settings.lang,
      count,
      exclude: [...exclude, ...(theme ? theme.words.map((w) => w[0]) : [])],
    });
    const { data: words } = await generateJson({ system, prompt, tier: "smart", temperature: 0.6 }, validatePack);
    const known = new Set(exclude);
    return NextResponse.json({ words: words.filter((w) => !known.has(normalizeKorean(w.korean))), level: settings.level });
  } catch (error) {
    return errorResponse(error);
  }
}
