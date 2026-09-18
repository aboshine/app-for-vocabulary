import { prisma } from "./db";
import {
  accuracyFromCounts,
  assembleCategoryProgress,
  rankDifficultWords,
  remainingToday,
} from "./dashboard";
import { endOfDay, scheduleReview, startOfDay, type Rating, type ReviewDirection } from "./srs";
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

export async function getReviewQueue(now = new Date(), limit = 50) {
  return prisma.vocabulary.findMany({
    where: { nextReviewAt: { lte: now } },
    orderBy: [{ nextReviewAt: "asc" }, { id: "asc" }],
    take: limit,
  });
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

export async function getDashboardStats(now = new Date()) {
  const dueLimit = endOfDay(now);
  const dayStart = startOfDay(now);
  const [total, newCount, learning, learned, dueToday, reviewsToday] = await Promise.all([
    prisma.vocabulary.count(),
    prisma.vocabulary.count({ where: { learningState: "new" } }),
    prisma.vocabulary.count({ where: { learningState: "learning" } }),
    prisma.vocabulary.count({ where: { learningState: "learned" } }),
    prisma.vocabulary.count({ where: { nextReviewAt: { lte: dueLimit } } }),
    prisma.review.count({ where: { createdAt: { gte: dayStart } } }),
  ]);
  return { total, new: newCount, learning, learned, dueToday, reviewsToday };
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function successTotal(groups: Array<{ rating: string; _count: { _all: number } }>) {
  let success = 0;
  let total = 0;
  for (const group of groups) {
    total += group._count._all;
    if (group.rating === "good" || group.rating === "easy") success += group._count._all;
  }
  return { success, total };
}

export async function getDashboardData(now = new Date()) {
  const dueLimit = endOfDay(now);
  const dayStart = startOfDay(now);
  const since7 = daysAgo(now, 7);
  const since30 = daysAgo(now, 30);
  const todayFilter = {
    OR: [{ nextReviewAt: { lte: dueLimit } }, { learningState: "new" }],
  };

  const [
    overdue,
    dueToday,
    newCount,
    recommended,
    reviewedToday,
    learning,
    learned,
    total,
    ratings7,
    ratings30,
    recentRatingGroups,
    recent,
    categoryGroups,
    categories,
  ] = await Promise.all([
    prisma.vocabulary.count({ where: { nextReviewAt: { lt: dayStart } } }),
    prisma.vocabulary.count({
      where: { nextReviewAt: { gte: dayStart, lte: dueLimit } },
    }),
    prisma.vocabulary.count({ where: { learningState: "new" } }),
    prisma.vocabulary.count({ where: todayFilter }),
    prisma.review.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.vocabulary.count({ where: { learningState: "learning" } }),
    prisma.vocabulary.count({ where: { learningState: "learned" } }),
    prisma.vocabulary.count(),
    prisma.review.groupBy({
      by: ["rating"],
      where: { createdAt: { gte: since7 } },
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ["vocabularyId", "rating"],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true },
    }),
    prisma.review.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rating: true,
        direction: true,
        createdAt: true,
        vocabulary: { select: { id: true, korean: true, meaning: true } },
      },
    }),
    prisma.vocabulary.groupBy({
      by: ["categoryId", "learningState"],
      _count: { _all: true },
    }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);

  const byWord = new Map<string, { success: number; total: number }>();
  for (const row of recentRatingGroups) {
    const current = byWord.get(row.vocabularyId) ?? { success: 0, total: 0 };
    current.total += row._count._all;
    if (row.rating === "good" || row.rating === "easy") current.success += row._count._all;
    byWord.set(row.vocabularyId, current);
  }
  const ranked = rankDifficultWords(
    [...byWord.entries()].map(([id, stats]) => ({
      id,
      korean: "",
      meaning: "",
      success: stats.success,
      total: stats.total,
    })),
  );
  const difficultWords = ranked.length
    ? await prisma.vocabulary.findMany({
        where: { id: { in: ranked.map((word) => word.id) } },
        select: { id: true, korean: true, meaning: true },
      })
    : [];
  const labels = new Map(difficultWords.map((word) => [word.id, word]));
  const seven = successTotal(ratings7);
  const thirty = successTotal(ratings30);

  return {
    today: {
      overdue,
      due: dueToday,
      new: newCount,
      recommended,
    },
    progress: {
      reviewedToday,
      remaining: remainingToday(recommended, reviewedToday),
      learning,
      learned,
      total,
    },
    retention: {
      days7: accuracyFromCounts(seven.success, seven.total),
      days30: accuracyFromCounts(thirty.success, thirty.total),
    },
    difficult: ranked.map((word) => ({
      id: word.id,
      korean: labels.get(word.id)?.korean ?? "",
      meaning: labels.get(word.id)?.meaning ?? "",
      successRate: word.total ? word.success / word.total : 0,
      reviews: word.total,
    })),
    recent: recent.map((item) => ({
      id: item.id,
      vocabularyId: item.vocabulary.id,
      korean: item.vocabulary.korean,
      meaning: item.vocabulary.meaning,
      rating: item.rating,
      direction: item.direction,
      createdAt: item.createdAt.toISOString(),
    })),
    categories: assembleCategoryProgress(
      categoryGroups.map((group) => ({
        categoryId: group.categoryId,
        learningState: group.learningState,
        count: group._count._all,
      })),
      new Map(categories.map((category) => [category.id, category.name])),
    ),
  };
}
