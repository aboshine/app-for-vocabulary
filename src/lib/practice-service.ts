import { generateJson } from "./ai/client";
import { parseLang, type TranslationLang } from "./ai/prompts";

const DISPLAY_LANG: Record<TranslationLang, string> = { ru: "Russian", en: "English", kk: "Kazakh" };
import {
  translatePrompt,
  validateTranslated,
  validateWriting,
  writingPrompt,
  WRITING_MAX_CHARS,
  type WritingFeedback,
} from "./ai/tutor-prompts";
import { getAiSettings } from "./ai-settings";
import { normalizeKorean } from "./curriculum";
import { prisma } from "./db";
import { weakWords } from "./plan-service";
import { shuffle } from "./weekly";
import { submitReview } from "./vocab-service";

/* ------------------------------------------------------------------ writing */

/** Today's writing task: one weak word (if any) plus two words being learned, and the latest grammar lesson as a bonus. */
export async function writingTask() {
  const [weak, learning, lesson, recent] = await Promise.all([
    weakWords(5),
    prisma.vocabulary.findMany({
      where: { learningState: "learning" },
      orderBy: { lastReviewedAt: "desc" },
      take: 20,
      select: { id: true, korean: true, meaning: true },
    }),
    prisma.grammarLesson.findFirst({ where: { completedAt: { not: null } }, orderBy: { completedAt: "desc" }, select: { title: true } }),
    prisma.writingEntry.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, text: true, createdAt: true } }),
  ]);
  const chosen: Array<{ id: string; korean: string; meaning: string }> = [];
  for (const w of [...shuffle(weak).slice(0, 1), ...shuffle(learning)]) {
    if (chosen.length >= 3) break;
    if (!chosen.some((c) => c.id === w.id)) chosen.push({ id: w.id, korean: w.korean, meaning: w.meaning });
  }
  return {
    words: chosen,
    grammar: lesson?.title ?? "",
    recent: recent.map((r) => ({ id: r.id, text: r.text, createdAt: r.createdAt.toISOString() })),
  };
}

/** Correct the learner's sentences. Target words that were used correctly count as a "good" review. */
export async function checkWriting(input: { text: string; wordIds: string[]; grammar: string }) {
  const text = input.text.trim().slice(0, WRITING_MAX_CHARS);
  if (!text) throw new Error("Write at least one sentence first.");
  if (!/[가-힣]/.test(text)) throw new Error("Write it in Korean (한글).");
  const [settings, words] = await Promise.all([
    getAiSettings(),
    prisma.vocabulary.findMany({ where: { id: { in: input.wordIds.slice(0, 6) } }, select: { id: true, korean: true, meaning: true } }),
  ]);
  const { system, prompt } = writingPrompt({ text, words, grammar: input.grammar.slice(0, 80), level: settings.level, lang: settings.lang });
  const { data } = await generateJson<WritingFeedback>({ system, prompt, tier: "smart", temperature: 0.2 }, validateWriting);

  const byKorean = new Map(words.map((w) => [normalizeKorean(w.korean), w.id]));
  let credited = 0;
  for (const w of data.words) {
    const id = byKorean.get(normalizeKorean(w.korean));
    if (!id || !w.correct) continue;
    byKorean.delete(normalizeKorean(w.korean)); // one credit per word
    await submitReview({ vocabularyId: id, rating: "good", direction: "writing" }).catch(() => undefined);
    credited += 1;
  }
  await prisma.writingEntry.create({ data: { wordIds: words.map((w) => w.id).join(","), text, feedback: JSON.stringify(data) } });
  return { feedback: data, credited };
}

/* ------------------------------------------------------------------ listening */

/** Words for a listening round: only words already studied, due ones first. */
export async function listeningWords(count = 10, now = new Date()) {
  const rows = await prisma.vocabulary.findMany({
    where: { reviewCount: { gt: 0 } },
    orderBy: { nextReviewAt: "asc" },
    take: 60,
    select: { id: true, korean: true, meaning: true, exampleSentence: true, nextReviewAt: true },
  });
  const due = rows.filter((r) => r.nextReviewAt <= now);
  const later = rows.filter((r) => r.nextReviewAt > now);
  return [...shuffle(due), ...shuffle(later)].slice(0, count).map((r) => ({ id: r.id, korean: r.korean, meaning: r.meaning, exampleSentence: r.exampleSentence }));
}

/**
 * Record one listening answer. A miss is a "hard" review (hearing is a harder skill than
 * reading, so it should not reset the card). A hit only counts when the card was due anyway,
 * so extra listening rounds cannot push intervals far ahead.
 */
export async function recordListening(vocabularyId: string, correct: boolean, now = new Date()) {
  const word = await prisma.vocabulary.findUnique({ where: { id: vocabularyId }, select: { nextReviewAt: true } });
  if (!word) throw new Error("Word not found");
  if (!correct) {
    await submitReview({ vocabularyId, rating: "hard", direction: "listening", now });
    return { recorded: "hard" as const };
  }
  if (word.nextReviewAt <= now) {
    await submitReview({ vocabularyId, rating: "good", direction: "listening", now });
    return { recorded: "good" as const };
  }
  return { recorded: null };
}

/* ------------------------------------------------------------------ translate the deck */

export const TRANSLATE_BATCH = 30;

export async function translateStatus() {
  const settings = await getAiSettings();
  const remaining = await prisma.vocabulary.count({ where: { meaningLang: { not: settings.lang } } });
  return { lang: settings.lang, langName: DISPLAY_LANG[settings.lang], remaining };
}

/** Translate the next batch of card meanings into the current explanation language. Call until remaining is 0. */
export async function translateBatch() {
  const settings = await getAiSettings();
  const lang = parseLang(settings.lang);
  const cards = await prisma.vocabulary.findMany({
    where: { meaningLang: { not: lang } },
    orderBy: { createdAt: "asc" },
    take: TRANSLATE_BATCH,
    select: { id: true, korean: true, meaning: true, exampleSentence: true },
  });
  if (!cards.length) return { translated: 0, ...(await translateStatus()) };
  const { system, prompt } = translatePrompt({
    cards: cards.map((c) => ({ korean: c.korean, meaning: c.meaning, example: c.exampleSentence })),
    lang,
  });
  const { data } = await generateJson({ system, prompt, tier: "smart", temperature: 0.2 }, validateTranslated);
  let translated = 0;
  const seen = new Set<number>();
  for (const row of data) {
    const card = cards[row.i];
    if (!card || seen.has(row.i)) continue;
    seen.add(row.i);
    await prisma.vocabulary.update({
      where: { id: card.id },
      data: {
        meaning: row.meaning,
        ...(card.exampleSentence && row.exampleTranslation ? { exampleTranslation: row.exampleTranslation } : {}),
        meaningLang: lang,
      },
    });
    translated += 1;
  }
  if (!translated) throw new Error("The AI answer could not be used. Try again.");
  return { translated, ...(await translateStatus()) };
}
