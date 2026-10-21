import { CURRICULUM, findTheme, type CurriculumEntry, type CurriculumTheme } from "@/data/curriculum";
import { prisma } from "./db";
import type { PackWord } from "./ai/prompts";
import { getSettings, updateSettings } from "./settings";
import type { LearningState } from "./srs";

export function normalizeKorean(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

export interface DeckEntry {
  korean: string;
  learningState: string;
}

export interface ThemeProgress {
  key: string;
  title: string;
  titleKo: string;
  level: number;
  total: number;
  inDeck: number;
  learned: number;
  remaining: number;
  preview: string[];
}

export function themeCategoryName(theme: Pick<CurriculumTheme, "titleKo" | "title">): string {
  return `${theme.titleKo} · ${theme.title}`;
}

export function themeProgress(theme: CurriculumTheme, deck: Map<string, string>): ThemeProgress {
  let inDeck = 0;
  let learned = 0;
  const missing: CurriculumEntry[] = [];
  for (const entry of theme.words) {
    const state = deck.get(normalizeKorean(entry[0]));
    if (state === undefined) {
      missing.push(entry);
      continue;
    }
    inDeck += 1;
    if (state === "learned") learned += 1;
  }
  return {
    key: theme.key,
    title: theme.title,
    titleKo: theme.titleKo,
    level: theme.level,
    total: theme.words.length,
    inDeck,
    learned,
    remaining: missing.length,
    preview: missing.slice(0, 6).map((entry) => entry[0]),
  };
}

/** Next words of a theme that are not in the deck yet, in curriculum order. */
export function nextEntries(theme: CurriculumTheme, deckWords: Set<string>, count: number): CurriculumEntry[] {
  return theme.words.filter((entry) => !deckWords.has(normalizeKorean(entry[0]))).slice(0, Math.max(0, count));
}

async function deckMap(): Promise<Map<string, string>> {
  const rows = await prisma.vocabulary.findMany({ select: { korean: true, learningState: true } });
  return new Map(rows.map((row) => [normalizeKorean(row.korean), row.learningState as LearningState]));
}

export async function listThemeProgress() {
  const [deck, settings] = await Promise.all([deckMap(), getSettings()]);
  return {
    currentTheme: settings.currentTheme,
    packSize: settings.packSize,
    themes: CURRICULUM.map((theme) => themeProgress(theme, deck)),
  };
}

async function ensureCategory(name: string): Promise<string> {
  const category = await prisma.category.upsert({ where: { name }, create: { name }, update: {} });
  return category.id;
}

/** Add the next `count` words of a curriculum theme to the deck and focus that theme. */
export async function addThemePack(themeKey: string, count?: number) {
  const theme = findTheme(themeKey);
  if (!theme) throw new Error("Unknown theme");
  const settings = await getSettings();
  const deck = await deckMap();
  const entries = nextEntries(theme, new Set(deck.keys()), count ?? settings.packSize);
  const categoryId = await ensureCategory(themeCategoryName(theme));
  if (entries.length) {
    await prisma.vocabulary.createMany({
      data: entries.map(([korean, meaning, exampleSentence, exampleTranslation]) => ({
        korean,
        meaning,
        exampleSentence,
        exampleTranslation,
        categoryId,
        source: "curriculum",
        level: `TOPIK${theme.level}`,
        tags: `topik${theme.level},${theme.key}`,
      })),
    });
  }
  if (settings.currentTheme !== theme.key) await updateSettings({ currentTheme: theme.key });
  return { added: entries.map((entry) => entry[0]), theme: theme.key };
}

/** Save AI-suggested words (already reviewed by the user) into a category named after the topic. */
export async function addCustomWords(input: { topic: string; words: PackWord[]; level: number }) {
  const deck = await deckMap();
  const fresh = input.words.filter((word) => !deck.has(normalizeKorean(word.korean)));
  const categoryName = input.topic.trim().slice(0, 80) || "AI";
  const theme = CURRICULUM.find((t) => t.key === input.topic);
  const categoryId = await ensureCategory(theme ? themeCategoryName(theme) : categoryName);
  if (fresh.length) {
    await prisma.vocabulary.createMany({
      data: fresh.map((word) => ({
        korean: normalizeKorean(word.korean),
        meaning: word.meaning,
        exampleSentence: word.exampleSentence,
        exampleTranslation: word.exampleTranslation,
        notes: word.notes,
        categoryId,
        source: "ai",
        level: `TOPIK${input.level}`,
      })),
    });
  }
  return { added: fresh.map((word) => word.korean), skipped: input.words.length - fresh.length };
}

export async function deckKoreanList(): Promise<string[]> {
  return [...(await deckMap()).keys()];
}
