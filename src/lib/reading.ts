import { findTheme } from "@/data/curriculum";
import { prisma } from "./db";
import { generateJson } from "./ai/client";
import { readingPrompt, validateReading, type ReadingPayload } from "./ai/prompts";
import { normalizeKorean, themeCategoryName } from "./curriculum";
import { getSettings } from "./settings";
import { endOfDay, type Rating } from "./srs";
import { submitReview } from "./vocab-service";

/* ------------------------------------------------------------------ pure helpers */

export interface TargetCandidate {
  id: string;
  korean: string;
  meaning: string;
  categoryId: string | null;
  learningState: string;
  nextReviewAt: Date;
  reviewCount: number;
  againCount: number;
  hardCount: number;
  createdAt: Date;
}

function difficulty(word: TargetCandidate): number {
  return word.reviewCount ? (word.againCount * 2 + word.hardCount) / word.reviewCount : 0;
}

/**
 * Pick the words today's text is built around:
 *  1. words of the focused theme that are still new or being learned (the "story" vocabulary),
 *  2. then any word due today, hardest first,
 *  3. then new words from anywhere, oldest first.
 * At most ~60% comes from step 1 so due words from other topics keep getting context too.
 */
export function selectTargets(
  words: TargetCandidate[],
  options: { count: number; themeCategoryId?: string | null; now: Date },
): TargetCandidate[] {
  const { count, themeCategoryId, now } = options;
  const dueLimit = endOfDay(now).getTime();
  const chosen: TargetCandidate[] = [];
  const taken = new Set<string>();
  const take = (list: TargetCandidate[], max: number) => {
    for (const word of list) {
      if (chosen.length >= count || max <= 0) break;
      if (taken.has(word.id)) continue;
      taken.add(word.id);
      chosen.push(word);
      max -= 1;
    }
  };

  if (themeCategoryId) {
    const themeWords = words
      .filter((w) => w.categoryId === themeCategoryId && w.learningState !== "learned")
      .sort((a, b) => {
        // learning first (already started), then new; within each, older first
        const rank = (w: TargetCandidate) => (w.learningState === "learning" ? 0 : 1);
        return rank(a) - rank(b) || a.createdAt.getTime() - b.createdAt.getTime();
      });
    take(themeWords, Math.ceil(count * 0.6));
  }

  const due = words
    .filter((w) => w.learningState !== "new" && w.nextReviewAt.getTime() <= dueLimit)
    .sort((a, b) => difficulty(b) - difficulty(a) || a.nextReviewAt.getTime() - b.nextReviewAt.getTime());
  take(due, count);

  const fresh = words
    .filter((w) => w.learningState === "new")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  take(fresh, count);

  return chosen;
}

/** Strip the 다 of verbs/adjectives so 먹다 matches 먹어요, 먹고 ... (only for stems of 2+ chars). */
function stemOf(korean: string): string {
  const k = normalizeKorean(korean);
  if (k.includes(" ")) return k.split(" ").pop()!.replace(/다$/, "");
  return k.endsWith("다") && k.length >= 3 ? k.slice(0, -1) : k;
}

/**
 * Map each token of the text to a deck word id (targets first, then any other deck word),
 * so the reader can highlight targets and show the deck status of any word.
 */
export function linkTokens(
  payload: ReadingPayload,
  deck: Array<{ id: string; korean: string }>,
  targetIds: string[],
): Array<Array<string | null>> {
  const byKorean = new Map(deck.map((w) => [normalizeKorean(w.korean), w.id]));
  const targets = deck.filter((w) => targetIds.includes(w.id));
  return payload.sentences.map((sentence) =>
    sentence.tokens.map((token) => {
      const lemma = normalizeKorean(token.lemma);
      if (lemma && byKorean.has(lemma)) return byKorean.get(lemma)!;
      // multi-word expressions (불을 켜다) are matched loosely against the lemma
      for (const target of targets) {
        const k = normalizeKorean(target.korean);
        const stem = stemOf(k);
        const head = k.split(" ").pop()!;
        if (lemma && (lemma === stem || (k.includes(" ") && lemma === head))) return target.id;
        if (stem.length >= 2 && token.t.startsWith(stem)) return target.id;
      }
      return null;
    }),
  );
}

export function dayKey(date: Date, timeZone = process.env.APP_TIMEZONE || "Asia/Seoul"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/* ------------------------------------------------------------------ service */

export interface ReadingView {
  id: string;
  day: string;
  level: string;
  theme: string;
  model: string;
  completedAt: string | null;
  payload: ReadingPayload;
  links: Array<Array<string | null>>;
  targets: Array<{ id: string; korean: string; meaning: string; learningState: string; found: boolean }>;
  deck: Record<string, { korean: string; meaning: string; learningState: string }>;
}

export async function readingView(id: string): Promise<ReadingView | null> {
  const text = await prisma.dailyText.findUnique({ where: { id } });
  if (!text) return null;
  const payload = JSON.parse(text.payload) as ReadingPayload;
  const targetIds = text.targetIds ? text.targetIds.split(",") : [];
  const deckRows = await prisma.vocabulary.findMany({
    select: { id: true, korean: true, meaning: true, learningState: true },
  });
  const links = linkTokens(payload, deckRows, targetIds);
  const linked = new Set(links.flat().filter(Boolean) as string[]);
  const deckById = new Map(deckRows.map((row) => [row.id, row]));
  const deck: ReadingView["deck"] = {};
  for (const wordId of linked) {
    const row = deckById.get(wordId);
    if (row) deck[wordId] = { korean: row.korean, meaning: row.meaning, learningState: row.learningState };
  }
  return {
    id: text.id,
    day: text.day,
    level: text.level,
    theme: text.theme,
    model: text.model,
    completedAt: text.completedAt?.toISOString() ?? null,
    payload,
    links,
    targets: targetIds
      .map((targetId) => deckById.get(targetId))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => ({ ...row, found: linked.has(row.id) })),
    deck,
  };
}

export async function listReadings(limit = 30) {
  return prisma.dailyText.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, day: true, title: true, level: true, theme: true, completedAt: true },
  });
}

export async function todaysReadingId(now = new Date()): Promise<string | null> {
  const text = await prisma.dailyText.findFirst({
    where: { day: dayKey(now) },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return text?.id ?? null;
}

export async function generateReading(now = new Date()): Promise<string> {
  const settings = await getSettings();
  const theme = settings.currentTheme ? findTheme(settings.currentTheme) : undefined;
  const themeCategory = theme
    ? await prisma.category.findUnique({ where: { name: themeCategoryName(theme) }, select: { id: true } })
    : null;

  const words = await prisma.vocabulary.findMany({
    select: {
      id: true,
      korean: true,
      meaning: true,
      categoryId: true,
      learningState: true,
      nextReviewAt: true,
      reviewCount: true,
      againCount: true,
      hardCount: true,
      createdAt: true,
    },
  });
  const targets = selectTargets(words, {
    count: settings.targetsPerText,
    themeCategoryId: themeCategory?.id ?? null,
    now,
  });
  const targetSet = new Set(targets.map((t) => t.id));
  // Known vocabulary = words already reviewed at least once (learning or learned).
  const known = words.filter((w) => w.learningState !== "new" && !targetSet.has(w.id)).map((w) => w.korean);

  const { system, prompt } = readingPrompt({
    level: settings.level,
    lang: settings.lang,
    theme: theme?.topic ?? "",
    targets: targets.map((t) => ({ korean: t.korean, meaning: t.meaning })),
    known,
  });
  const { data, model } = await generateJson({ system, prompt, tier: "smart", maxOutputTokens: 12000 }, validateReading);

  const created = await prisma.dailyText.create({
    data: {
      day: dayKey(now),
      level: String(settings.level),
      theme: theme ? theme.key : "",
      title: data.title,
      payload: JSON.stringify(data),
      targetIds: targets.map((t) => t.id).join(","),
      model,
    },
  });
  return created.id;
}

/** Record how well each target word was understood and mark the text as read. */
export async function completeReading(id: string, results: Array<{ vocabularyId: string; rating: Rating }>) {
  const text = await prisma.dailyText.findUnique({ where: { id } });
  if (!text) throw new Error("Text not found");
  const allowed = new Set(text.targetIds.split(",").filter(Boolean));
  const already = text.completedAt !== null;
  if (!already) {
    for (const result of results) {
      if (!allowed.has(result.vocabularyId)) continue;
      await submitReview({ vocabularyId: result.vocabularyId, rating: result.rating, direction: "reading" });
    }
  }
  await prisma.dailyText.update({ where: { id }, data: { completedAt: text.completedAt ?? new Date() } });
  return { reviewed: already ? 0 : results.filter((r) => allowed.has(r.vocabularyId)).length };
}
