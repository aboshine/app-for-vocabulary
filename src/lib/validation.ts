import { LEARNING_STATES, type LearningState } from "./srs";

export const LIMITS = {
  korean: 200,
  meaning: 200,
  example: 500,
  notes: 1000,
  tags: 200,
  category: 80,
  title: 200,
  explanation: 4000,
  structure: 500,
} as const;

export async function readJson(request: Request): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false };
  }
}

function asRecord(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

function clip(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

export interface VocabInput {
  korean: string;
  meaning: string;
  exampleSentence: string;
  exampleTranslation: string;
  notes: string;
  categoryId: string | null;
  tags: string;
}

export function parseVocabInput(body: unknown): VocabInput | string {
  const data = asRecord(body);
  if (!data) return "Invalid payload.";
  const korean = clip(data.korean, LIMITS.korean);
  const meaning = clip(data.meaning, LIMITS.meaning);
  if (!korean || !meaning) return "Korean and meaning are required.";
  const categoryId = clip(data.categoryId, 64);
  return {
    korean,
    meaning,
    exampleSentence: clip(data.exampleSentence, LIMITS.example),
    exampleTranslation: clip(data.exampleTranslation, LIMITS.example),
    notes: clip(data.notes, LIMITS.notes),
    categoryId: categoryId || null,
    tags: clip(data.tags, LIMITS.tags),
  };
}

export function parseCategoryName(body: unknown): string | { error: string } {
  const data = asRecord(body);
  const name = clip(data?.name, LIMITS.category);
  if (!name) return { error: "Name is required." };
  return name;
}

export function parseLearningState(value: string | null): LearningState | undefined {
  if (!value) return undefined;
  return LEARNING_STATES.includes(value as LearningState)
    ? (value as LearningState)
    : undefined;
}

export function matchesSearch(
  word: { korean: string; meaning: string },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    word.korean.toLowerCase().includes(needle) ||
    word.meaning.toLowerCase().includes(needle)
  );
}

export interface GrammarExample {
  sentence: string;
  translation: string;
}

export interface GrammarInput {
  title: string;
  meaning: string;
  explanation: string;
  structure: string;
  examples: GrammarExample[];
  notes: string;
  categoryId: string | null;
  tags: string;
}

function parseExampleList(value: unknown): GrammarExample[] {
  if (!Array.isArray(value)) return [];
  const examples: GrammarExample[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const sentence = clip(row.sentence ?? row.korean, LIMITS.example);
    const translation = clip(row.translation, LIMITS.example);
    if (!sentence && !translation) continue;
    examples.push({ sentence, translation });
  }
  return examples;
}

export function parseStoredExamples(value: string): GrammarExample[] {
  try {
    return parseExampleList(JSON.parse(value));
  } catch {
    return [];
  }
}

export function serializeExamples(examples: GrammarExample[]): string {
  return JSON.stringify(examples);
}

export function parseGrammarInput(body: unknown): GrammarInput | string {
  const data = asRecord(body);
  if (!data) return "Invalid payload.";
  const title = clip(data.title, LIMITS.title);
  const meaning = clip(data.meaning, LIMITS.meaning);
  if (!title || !meaning) return "Title and meaning are required.";
  const categoryId = clip(data.categoryId, 64);
  return {
    title,
    meaning,
    explanation: clip(data.explanation, LIMITS.explanation),
    structure: clip(data.structure, LIMITS.structure),
    examples: parseExampleList(data.examples),
    notes: clip(data.notes, LIMITS.notes),
    categoryId: categoryId || null,
    tags: clip(data.tags, LIMITS.tags),
  };
}

export function matchesGrammarSearch(
  item: { title: string; meaning: string; explanation: string; structure: string; tags: string },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    item.title.toLowerCase().includes(needle) ||
    item.meaning.toLowerCase().includes(needle) ||
    item.explanation.toLowerCase().includes(needle) ||
    item.structure.toLowerCase().includes(needle) ||
    item.tags.toLowerCase().includes(needle)
  );
}
