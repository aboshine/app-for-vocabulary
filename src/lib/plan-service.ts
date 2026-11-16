import { aiStatus } from "./ai/client";
import { accuracyFromCounts } from "./dashboard";
import { addDays, appTimeZone, dayKey, startOfLocalDay, weekdayIndex, weekStart } from "./day";
import { prisma } from "./db";
import {
  buildDailySteps,
  computeStreak,
  dayComplete,
  isWeakWord,
  minutesLeft,
  parseDailyMinutes,
  PLAN_PRESETS,
  STREAK_MIN_REVIEWS,
  weekDots,
  type DailyMinutes,
} from "./plan";
import { DEFAULT_SETTINGS, SETTINGS_ID, settingsToRow } from "./settings";
import { countNewIntroducedToday, getSettings } from "./settings-service";
import { weeklyIsDue, type WeeklySummary } from "./weekly";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days (YYYY-MM-DD, app time zone) on which enough cards were answered to count as a study day.
 * Counted inside the database: one small grouped query instead of loading every review row.
 */
export async function activeDaySet(now = new Date(), daysBack = 370): Promise<Set<string>> {
  const since = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const tz = appTimeZone();
  const rows = await prisma.$queryRaw<Array<{ day: string; n: number }>>`
    SELECT day, SUM(n)::int AS n FROM (
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day, COUNT(*) AS n
      FROM "Review" WHERE "createdAt" >= ${since} GROUP BY 1
      UNION ALL
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day, COUNT(*) AS n
      FROM "GrammarReview" WHERE "createdAt" >= ${since} GROUP BY 1
    ) t GROUP BY day`;
  return new Set(rows.filter((row) => row.n >= STREAK_MIN_REVIEWS).map((row) => row.day));
}

export function activeDaysInLastWeek(days: Set<string>, today: string): number {
  let n = 0;
  for (let i = 0; i < 7; i += 1) if (days.has(addDays(today, -i))) n += 1;
  return n;
}

export async function weakWords(limit = 50) {
  const rows = await prisma.vocabulary.findMany({
    where: { againCount: { gte: 3 } },
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
      intervalMinutes: true,
      reviewCount: true,
      againCount: true,
      hardCount: true,
      goodCount: true,
      easyCount: true,
    },
  });
  return rows
    .filter(isWeakWord)
    .sort((a, b) => (a.goodCount + a.easyCount) / a.reviewCount - (b.goodCount + b.easyCount) / b.reviewCount || b.againCount - a.againCount)
    .slice(0, limit);
}

export async function getDailyMinutes(): Promise<DailyMinutes> {
  const row = await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID }, select: { dailyMinutes: true } });
  return parseDailyMinutes(row?.dailyMinutes);
}

/** Change the daily time budget and reset new words / review target to that preset. */
export async function setDailyMinutes(value: unknown): Promise<DailyMinutes> {
  const minutes = parseDailyMinutes(value);
  const preset = PLAN_PRESETS[minutes];
  const data = { dailyMinutes: minutes, dailyNewWordLimit: preset.newWords, dailyReviewTarget: preset.reviewTarget };
  await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...settingsToRow(DEFAULT_SETTINGS), ...data },
    update: data,
  });
  return minutes;
}

export async function weeklyDueState(now = new Date()) {
  const [last, studiedWords, first] = await Promise.all([
    prisma.weeklyCheck.findFirst({ where: { completedAt: { not: null } }, orderBy: { completedAt: "desc" } }),
    prisma.vocabulary.count({ where: { reviewCount: { gt: 0 } } }),
    prisma.review.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  return {
    due: weeklyIsDue({ lastCompletedAt: last?.completedAt ?? null, studiedWords, firstReviewAt: first?.createdAt ?? null, now }),
    last,
  };
}

export async function getPlan(now = new Date()) {
  const today = dayKey(now);
  const dayStart = startOfLocalDay(now);
  // Monday 00:00 local time (the +12h keeps us safely inside that day before snapping to its start).
  const weekStartDate = startOfLocalDay(new Date(dayStart.getTime() - weekdayIndex(today) * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000));

  const [settings, minutes, days, dueNow, reviewedVocab, reviewedGrammar, newWaiting, newIntroducedToday, texts, grammarThisWeek, weekly, weak, totals, ratings7, ratings30] =
    await Promise.all([
      getSettings(),
      getDailyMinutes(),
      activeDaySet(now),
      prisma.vocabulary.count({ where: { learningState: { not: "new" }, nextReviewAt: { lte: now } } }),
      prisma.review.count({ where: { createdAt: { gte: dayStart } } }),
      prisma.grammarReview.count({ where: { createdAt: { gte: dayStart } } }),
      prisma.vocabulary.count({ where: { learningState: "new" } }),
      countNewIntroducedToday(now),
      prisma.dailyText.findMany({ where: { day: today }, select: { completedAt: true } }),
      prisma.grammarLesson.count({ where: { completedAt: { gte: weekStartDate } } }),
      weeklyDueState(now),
      weakWords(),
      prisma.vocabulary.groupBy({ by: ["learningState"], _count: { _all: true } }),
      prisma.review.groupBy({ by: ["rating"], where: { createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } }, _count: { _all: true } }),
      prisma.review.groupBy({ by: ["rating"], where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } }, _count: { _all: true } }),
    ]);
  const accuracy = (groups: Array<{ rating: string; _count: { _all: number } }>) => {
    const total = groups.reduce((sum, g) => sum + g._count._all, 0);
    const success = groups.filter((g) => g.rating === "good" || g.rating === "easy").reduce((sum, g) => sum + g._count._all, 0);
    return accuracyFromCounts(success, total);
  };

  const preset = PLAN_PRESETS[minutes];
  const steps = buildDailySteps({
    dueNow,
    reviewedToday: reviewedVocab + reviewedGrammar,
    reviewTarget: settings.dailyReviewTarget,
    newWaiting,
    newIntroducedToday,
    newPerDay: settings.dailyNewWordLimit,
    readingDone: texts.some((t) => t.completedAt),
    readingExists: texts.length > 0,
    aiConfigured: aiStatus().configured,
    grammarThisWeek,
    grammarPerWeek: preset.grammarPerWeek,
    weeklyDue: weekly.due,
    weakCount: weak.length,
    weekday: weekdayIndex(today),
  });
  const count = (state: string) => totals.find((t) => t.learningState === state)?._count._all ?? 0;
  let lastWeekly: { completedAt: string; score: number; total: number; message: string; delta: number } | null = null;
  if (weekly.last?.completedAt) {
    try {
      const summary = JSON.parse(weekly.last.summary) as WeeklySummary;
      lastWeekly = {
        completedAt: weekly.last.completedAt.toISOString(),
        score: weekly.last.score,
        total: weekly.last.total,
        message: summary.adjustment?.message ?? "",
        delta: summary.adjustment?.delta ?? 0,
      };
    } catch {
      lastWeekly = null;
    }
  }

  return {
    day: today,
    weekStart: weekStart(today),
    streak: computeStreak(days, today),
    week: weekDots(days, today),
    reviewedToday: reviewedVocab + reviewedGrammar,
    streakMin: STREAK_MIN_REVIEWS,
    steps,
    complete: dayComplete(steps),
    minutesLeft: minutesLeft(steps),
    plan: { minutes, newPerDay: settings.dailyNewWordLimit, reviewTarget: settings.dailyReviewTarget, grammarPerWeek: preset.grammarPerWeek },
    weak: weak.slice(0, 8).map((w) => ({
      id: w.id,
      korean: w.korean,
      meaning: w.meaning,
      successRate: (w.goodCount + w.easyCount) / w.reviewCount,
      againCount: w.againCount,
    })),
    weakCount: weak.length,
    weeklyDue: weekly.due,
    lastWeekly,
    retention: { days7: accuracy(ratings7), days30: accuracy(ratings30) },
    deck: { total: count("new") + count("learning") + count("learned"), new: count("new"), learning: count("learning"), learned: count("learned") },
  };
}

export type PlanView = Awaited<ReturnType<typeof getPlan>>;
