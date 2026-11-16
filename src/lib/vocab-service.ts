import { prisma } from "./db";
import { endOfDay, scheduleReview, type Rating, type ReviewDirection } from "./srs";
import { matchesSearch, parseLearningState } from "./validation";

export async function listVocabulary(filters: {
  q?: string;
  categoryId?: string;
  state?: string;
}) {
  const state = parseLearningState(filters.state ?? null);
  const words = await prisma.vocabulary.findMany({
    where: {
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(state ? { learningState: state } : {}),
    },
    include: { category: true },
    orderBy: { updatedAt: "desc" },
  });
  const q = filters.q?.trim();
  return q ? words.filter((word) => matchesSearch(word, q)) : words;
}

export async function getReviewPool(categoryId?: string, now = new Date()) {
  return prisma.vocabulary.findMany({
    where: {
      ...(categoryId ? { categoryId } : {}),
      OR: [
        { nextReviewAt: { lte: endOfDay(now) } },
        { learningState: "new" },
      ],
    },
    select: {
      id: true,
      korean: true,
      meaning: true,
      exampleSentence: true,
      exampleTranslation: true,
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

export async function submitReview(input: {
  vocabularyId: string;
  rating: Rating;
  direction: ReviewDirection;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const word = await prisma.vocabulary.findUnique({
    where: { id: input.vocabularyId },
  });
  if (!word) {
    throw new Error("Word not found");
  }

  const scheduled = scheduleReview(
    {
      intervalMinutes: word.intervalMinutes,
      learningState: word.learningState as "new" | "learning" | "learned",
    },
    input.rating,
    now,
  );

  const ratingCountField = {
    again: "againCount",
    hard: "hardCount",
    good: "goodCount",
    easy: "easyCount",
  }[input.rating] as "againCount" | "hardCount" | "goodCount" | "easyCount";

  const [updated] = await prisma.$transaction([
    prisma.vocabulary.update({
      where: { id: word.id },
      data: {
        intervalMinutes: scheduled.intervalMinutes,
        nextReviewAt: scheduled.nextReviewAt,
        lastReviewedAt: now,
        learningState: scheduled.learningState,
        reviewCount: { increment: 1 },
        [ratingCountField]: { increment: 1 },
      },
    }),
    prisma.review.create({
      data: {
        vocabularyId: word.id,
        rating: input.rating,
        direction: input.direction,
        intervalBefore: word.intervalMinutes,
        intervalAfter: scheduled.intervalMinutes,
        createdAt: now,
      },
    }),
  ]);

  return updated;
}
