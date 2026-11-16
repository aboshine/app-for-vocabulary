import { findSyllabusItem, GRAMMAR_SYLLABUS, nextSyllabusItem } from "@/data/grammar-syllabus";
import { generateJson, generateText } from "./ai/client";
import {
  chatPrompt,
  explainPrompt,
  lessonPrompt,
  validateExplain,
  validateLesson,
  validateWordHelp,
  wordHelpPrompt,
  type ChatMessage,
  type LessonPayload,
} from "./ai/tutor-prompts";
import { getAiSettings } from "./ai-settings";
import { prisma } from "./db";
import { weakWords } from "./plan-service";
import { LIMITS, serializeExamples } from "./validation";

export async function explainText(text: string) {
  const clean = text.trim();
  if (!clean) throw new Error("Paste a Korean sentence first.");
  if (!/[가-힣]/.test(clean)) throw new Error("That does not look like Korean text.");
  const settings = await getAiSettings();
  const { system, prompt } = explainPrompt(clean, settings.level, settings.lang);
  const { data } = await generateJson({ system, prompt, tier: "smart", temperature: 0.3 }, validateExplain);
  return data;
}

export async function wordHelp(vocabularyId: string) {
  const word = await prisma.vocabulary.findUnique({ where: { id: vocabularyId }, select: { korean: true, meaning: true } });
  if (!word) throw new Error("Word not found");
  const settings = await getAiSettings();
  const { system, prompt } = wordHelpPrompt({ ...word, level: settings.level, lang: settings.lang });
  const { data } = await generateJson({ system, prompt, tier: "smart", temperature: 0.7 }, validateWordHelp);
  return data;
}

export async function chat(messages: ChatMessage[]) {
  if (!messages.length || messages[messages.length - 1].role !== "user") throw new Error("Write a question first.");
  const [settings, weak] = await Promise.all([getAiSettings(), weakWords(15)]);
  const { system, prompt } = chatPrompt({ messages, level: settings.level, lang: settings.lang, weakWords: weak.map((w) => w.korean) });
  const { data } = await generateText({ system, prompt, tier: "smart", temperature: 0.6, maxOutputTokens: 2048 });
  return data;
}

/* ------------------------------------------------------------------ grammar lessons */

export async function lessonList() {
  const [settings, lessons] = await Promise.all([
    getAiSettings(),
    prisma.grammarLesson.findMany({ select: { id: true, patternKey: true, completedAt: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const byKey = new Map<string, { id: string; done: boolean }>();
  for (const lesson of lessons) {
    const current = byKey.get(lesson.patternKey);
    // a finished lesson wins over a merely opened one
    if (!current || (!current.done && lesson.completedAt)) byKey.set(lesson.patternKey, { id: lesson.id, done: Boolean(lesson.completedAt) });
  }
  const done = new Set([...byKey.entries()].filter(([, v]) => v.done).map(([key]) => key));
  return {
    level: settings.level,
    next: nextSyllabusItem(done, settings.level)?.key ?? null,
    items: GRAMMAR_SYLLABUS.map((entry) => ({
      key: entry.key,
      pattern: entry.pattern,
      level: entry.level,
      lessonId: byKey.get(entry.key)?.id ?? null,
      done: done.has(entry.key),
    })),
  };
}

function lessonView(row: { id: string; patternKey: string; payload: string; completedAt: Date | null; grammarId: string }) {
  return {
    id: row.id,
    patternKey: row.patternKey,
    completedAt: row.completedAt?.toISOString() ?? null,
    grammarId: row.grammarId,
    payload: JSON.parse(row.payload) as LessonPayload,
  };
}

export type LessonView = ReturnType<typeof lessonView>;

/** Open the lesson for a syllabus pattern, writing it with AI the first time (or again if the language changed). */
export async function openLesson(key: string, regenerate = false): Promise<LessonView> {
  const entry = findSyllabusItem(key);
  if (!entry) throw new Error("Unknown grammar point");
  const settings = await getAiSettings();
  if (!regenerate) {
    const existing = await prisma.grammarLesson.findFirst({ where: { patternKey: key, lang: settings.lang }, orderBy: { createdAt: "desc" } });
    if (existing) return lessonView(existing);
  }
  const known = await prisma.vocabulary.findMany({
    where: { learningState: { not: "new" } },
    select: { korean: true },
    orderBy: { lastReviewedAt: "desc" },
    take: 150,
  });
  const { system, prompt } = lessonPrompt({
    pattern: entry.pattern,
    hint: entry.hint,
    level: settings.level,
    lang: settings.lang,
    known: known.map((w) => w.korean),
  });
  const { data } = await generateJson({ system, prompt, tier: "smart", temperature: 0.5 }, validateLesson);
  const created = await prisma.grammarLesson.create({
    data: { patternKey: key, title: entry.pattern, lang: settings.lang, payload: JSON.stringify(data) },
  });
  return lessonView(created);
}

export async function getLesson(id: string): Promise<LessonView | null> {
  const row = await prisma.grammarLesson.findUnique({ where: { id } });
  return row ? lessonView(row) : null;
}

/** Text of the grammar card made from a lesson. */
export function lessonToGrammarCard(pattern: string, lesson: LessonPayload) {
  const explanation = [lesson.explanation, lesson.compare ? `≈ ${lesson.compare}` : "", lesson.mistake ? `⚠ ${lesson.mistake}` : ""]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, LIMITS.explanation);
  return {
    title: pattern.slice(0, LIMITS.title),
    meaning: (lesson.meaning || lesson.title).slice(0, LIMITS.meaning),
    explanation,
    structure: lesson.structure.slice(0, LIMITS.structure),
    examples: serializeExamples(lesson.examples.map((e) => ({ sentence: e.ko.slice(0, LIMITS.example), translation: e.tr.slice(0, LIMITS.example) }))),
    notes: "",
    tags: "ai-lesson",
  };
}

/** Finish a lesson: it becomes a grammar card that joins spaced repetition. */
export async function completeLesson(id: string, now = new Date()) {
  const row = await prisma.grammarLesson.findUnique({ where: { id } });
  if (!row) throw new Error("Lesson not found");
  if (row.completedAt) return lessonView(row);
  const card = lessonToGrammarCard(row.title, JSON.parse(row.payload) as LessonPayload);
  // Reuse a card the learner already has for this pattern instead of making a duplicate.
  const existing = await prisma.grammar.findFirst({ where: { title: card.title }, select: { id: true } });
  const grammarId = existing?.id ?? (await prisma.grammar.create({ data: card, select: { id: true } })).id;
  const updated = await prisma.grammarLesson.update({ where: { id }, data: { completedAt: now, grammarId } });
  return lessonView(updated);
}
