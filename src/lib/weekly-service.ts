import { generateText } from "./ai/client";
import { weeklyNotePrompt } from "./ai/tutor-prompts";
import { getAiSettings } from "./ai-settings";
import { dayKey } from "./day";
import { prisma } from "./db";
import { adjustPlan } from "./plan";
import { activeDaySet, activeDaysInLastWeek, getDailyMinutes, weakWords, weeklyDueState } from "./plan-service";
import { SETTINGS_ID } from "./settings";
import { getSettings } from "./settings-service";
import { submitReview } from "./vocab-service";
import {
  buildWeeklyQuestions,
  gradeWeekly,
  pickWeeklyWords,
  publicQuestions,
  questionCount,
  WEEKLY_MIN_STUDIED,
  type WeeklyQuestion,
  type WeeklySummary,
} from "./weekly";

const OPEN_CHECK_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

function parseSummary(raw: string): WeeklySummary | null {
  try {
    return raw ? (JSON.parse(raw) as WeeklySummary) : null;
  } catch {
    return null;
  }
}

async function openCheck(now: Date) {
  return prisma.weeklyCheck.findFirst({
    where: { completedAt: null, createdAt: { gte: new Date(now.getTime() - OPEN_CHECK_MAX_AGE_MS) } },
    orderBy: { createdAt: "desc" },
  });
}

export async function weeklyState(now = new Date()) {
  const [state, open, history] = await Promise.all([
    weeklyDueState(now),
    openCheck(now),
    prisma.weeklyCheck.findMany({
      where: { completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 8,
      select: { id: true, score: true, total: true, completedAt: true, summary: true },
    }),
  ]);
  return {
    due: state.due,
    open: open ? { id: open.id, questions: publicQuestions(JSON.parse(open.questions) as WeeklyQuestion[]) } : null,
    history: history.map((h) => ({
      id: h.id,
      score: h.score,
      total: h.total,
      completedAt: h.completedAt!.toISOString(),
      message: parseSummary(h.summary)?.adjustment?.message ?? "",
    })),
  };
}

/** Start a check (or continue the unfinished one). */
export async function startWeekly(now = new Date()) {
  const existing = await openCheck(now);
  if (existing) return { id: existing.id, questions: publicQuestions(JSON.parse(existing.questions) as WeeklyQuestion[]) };

  const deck = await prisma.vocabulary.findMany({
    select: {
      id: true,
      korean: true,
      meaning: true,
      learningState: true,
      reviewCount: true,
      againCount: true,
      hardCount: true,
      lastReviewedAt: true,
      createdAt: true,
    },
  });
  if (deck.filter((w) => w.reviewCount > 0).length < WEEKLY_MIN_STUDIED) {
    throw new Error(`Study at least ${WEEKLY_MIN_STUDIED} words first, then take the check.`);
  }
  const minutes = await getDailyMinutes();
  const questions = buildWeeklyQuestions(pickWeeklyWords(deck, questionCount(minutes), now), deck);
  const created = await prisma.weeklyCheck.create({ data: { questions: JSON.stringify(questions), total: questions.length } });
  return { id: created.id, questions: publicQuestions(questions) };
}

/** Grade the check, send missed words back into learning and adjust next week's load. */
export async function submitWeekly(id: string, answers: string[], now = new Date()) {
  const check = await prisma.weeklyCheck.findUnique({ where: { id } });
  if (!check) throw new Error("Check not found");
  if (check.completedAt) return { id, score: check.score, total: check.total, summary: parseSummary(check.summary) };

  const questions = JSON.parse(check.questions) as WeeklyQuestion[];
  const rows = gradeWeekly(questions, answers);
  const score = rows.filter((r) => r.correct).length;
  const accuracy = rows.length ? score / rows.length : 0;

  // Missed words go back to the start of the queue: they are due again today.
  for (const row of rows) {
    if (row.correct) continue;
    try {
      await submitReview({ vocabularyId: row.vocabularyId, rating: "again", direction: "weekly", now });
    } catch {
      // the word was deleted meanwhile
    }
  }

  const [settings, minutes, days, backlog, weak, ai] = await Promise.all([
    getSettings(),
    getDailyMinutes(),
    activeDaySet(now, 10),
    prisma.vocabulary.count({ where: { learningState: { not: "new" }, nextReviewAt: { lte: now } } }),
    weakWords(),
    getAiSettings(),
  ]);
  const activeDays = activeDaysInLastWeek(days, dayKey(now));
  const adjustment = adjustPlan({
    accuracy,
    activeDays,
    // the words just missed are due now by design; do not count them as a backlog
    backlog: Math.max(0, backlog - (rows.length - score)),
    weakCount: weak.length,
    newPerDay: settings.dailyNewWordLimit,
    minutes,
  });

  let comment = "";
  try {
    const { system, prompt } = weeklyNotePrompt({
      lang: ai.lang,
      score,
      total: rows.length,
      activeDays,
      missed: rows.filter((r) => !r.correct).map((r) => (r.kind === "ko-choice" ? { korean: r.prompt, meaning: r.answer } : { korean: r.answer, meaning: r.prompt })),
      planMessage: adjustment.message,
    });
    comment = (await generateText({ system, prompt, tier: "fast", temperature: 0.6, maxOutputTokens: 1024 })).data.slice(0, 1200);
  } catch {
    comment = ""; // AI is optional here
  }

  const summary: WeeklySummary = { rows, accuracy, activeDays, adjustment, comment };
  await prisma.$transaction([
    prisma.weeklyCheck.update({ where: { id }, data: { completedAt: now, score, total: rows.length, summary: JSON.stringify(summary) } }),
    prisma.appSettings.update({ where: { id: SETTINGS_ID }, data: { dailyNewWordLimit: adjustment.newPerDay } }),
  ]);
  return { id, score, total: rows.length, summary };
}
