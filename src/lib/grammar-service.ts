import { prisma } from "./db";
import { applyGrammarReview } from "./grammar";
import { endOfDay, type Rating } from "./srs";
import {
  matchesGrammarSearch,
  parseLearningState,
  parseStoredExamples,
  serializeExamples,
  type GrammarInput,
} from "./validation";

function toCreateData(input: GrammarInput) {
  return {
    title: input.title,
    meaning: input.meaning,
    explanation: input.explanation,
    structure: input.structure,
    examples: serializeExamples(input.examples),
    notes: input.notes,
    categoryId: input.categoryId,
    tags: input.tags,
  };
}

export async function listGrammar(filters: {
  q?: string;
  categoryId?: string;
  state?: string;
}) {
  const state = parseLearningState(filters.state ?? null);
  const items = await prisma.grammar.findMany({
    where: {
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(state ? { learningState: state } : {}),
    },
    include: { category: true },
    orderBy: { updatedAt: "desc" },
  });
  const q = filters.q?.trim();
  return q ? items.filter((item) => matchesGrammarSearch(item, q)) : items;
}

export async function createGrammar(input: GrammarInput) {
  return prisma.grammar.create({
    data: toCreateData(input),
    include: { category: true },
  });
}

export async function updateGrammar(id: string, input: GrammarInput) {
  return prisma.grammar.update({
    where: { id },
    data: toCreateData(input),
    include: { category: true },
  });
}

export async function deleteGrammar(id: string) {
  await prisma.grammar.delete({ where: { id } });
}

export async function getGrammarReviewPool(categoryId?: string, now = new Date()) {
  return prisma.grammar.findMany({
    where: {
      ...(categoryId ? { categoryId } : {}),
      OR: [{ nextReviewAt: { lte: endOfDay(now) } }, { learningState: "new" }],
    },
    select: {
      id: true,
      title: true,
      meaning: true,
      explanation: true,
      structure: true,
      examples: true,
      notes: true,
      categoryId: true,
      learningState: true,
      nextReviewAt: true,
      reviewCount: true,
      againCount: true,
      hardCount: true,
      goodCount: true,
      easyCount: true,
    },
  });
}

export async function submitGrammarReview(input: {
  grammarId: string;
  rating: Rating;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const item = await prisma.grammar.findUnique({ where: { id: input.grammarId } });
  if (!item) {
    throw new Error("Grammar not found");
  }

  const applied = applyGrammarReview(
    {
      intervalMinutes: item.intervalMinutes,
      learningState: item.learningState as "new" | "learning" | "learned",
      reviewCount: item.reviewCount,
      againCount: item.againCount,
      hardCount: item.hardCount,
      goodCount: item.goodCount,
      easyCount: item.easyCount,
    },
    input.rating,
    now,
  );

  const [updated] = await prisma.$transaction([
    prisma.grammar.update({
      where: { id: item.id },
      data: {
        intervalMinutes: applied.intervalMinutes,
        nextReviewAt: applied.nextReviewAt,
        lastReviewedAt: applied.lastReviewedAt,
        learningState: applied.learningState,
        reviewCount: applied.reviewCount,
        againCount: applied.againCount,
        hardCount: applied.hardCount,
        goodCount: applied.goodCount,
        easyCount: applied.easyCount,
      },
    }),
    prisma.grammarReview.create({
      data: {
        grammarId: item.id,
        rating: applied.historyEntry.rating,
        intervalBefore: applied.historyEntry.intervalBefore,
        intervalAfter: applied.historyEntry.intervalAfter,
        createdAt: now,
      },
    }),
  ]);

  return updated;
}

export function parseGrammarExamples(examples: string) {
  return parseStoredExamples(examples);
}
