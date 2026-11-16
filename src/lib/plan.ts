import { addDays, weekStart } from "./day";

/**
 * Study plan logic (pure). The plan is sized by how many minutes a day the learner
 * has, and the weekly check moves the "new words per day" number up or down.
 */

export const MINUTE_PRESETS = [15, 25, 40] as const;
export type DailyMinutes = (typeof MINUTE_PRESETS)[number];

export interface PlanPreset {
  /** starting point for new words per day */
  newWords: number;
  /** the weekly check never pushes new words above this */
  maxNewWords: number;
  reviewTarget: number;
  grammarPerWeek: number;
}

export const PLAN_PRESETS: Record<DailyMinutes, PlanPreset> = {
  15: { newWords: 5, maxNewWords: 8, reviewTarget: 20, grammarPerWeek: 2 },
  25: { newWords: 8, maxNewWords: 14, reviewTarget: 30, grammarPerWeek: 3 },
  40: { newWords: 15, maxNewWords: 25, reviewTarget: 50, grammarPerWeek: 5 },
};

export const MIN_NEW_WORDS = 2;
/** A day counts for the streak once this many cards were answered (reading counts too). */
export const STREAK_MIN_REVIEWS = 5;

export function parseDailyMinutes(value: unknown, fallback: DailyMinutes = 15): DailyMinutes {
  const n = Number(value);
  return (MINUTE_PRESETS as readonly number[]).includes(n) ? (n as DailyMinutes) : fallback;
}

/* ------------------------------------------------------------------ streak */

export interface Streak {
  /** consecutive active days up to today (today counts only if already done) */
  current: number;
  todayDone: boolean;
  /** the streak is alive but today is not done yet */
  atRisk: boolean;
  best: number;
}

export function computeStreak(activeDays: Iterable<string>, today: string): Streak {
  const days = new Set(activeDays);
  const todayDone = days.has(today);
  let current = 0;
  let cursor = todayDone ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue; // not the start of a run
    let length = 0;
    let c = day;
    while (days.has(c)) {
      length += 1;
      c = addDays(c, 1);
    }
    best = Math.max(best, length);
  }
  return { current, todayDone, atRisk: !todayDone && current > 0, best: Math.max(best, current) };
}

/** Mon..Sun of the current week: was the learner active on each day? */
export function weekDots(activeDays: Iterable<string>, today: string): Array<{ day: string; active: boolean; future: boolean; today: boolean }> {
  const days = new Set(activeDays);
  const start = weekStart(today);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    return { day, active: days.has(day), future: day > today, today: day === today };
  });
}

/* ------------------------------------------------------------------ today's steps */

export interface PlanInput {
  /** cards already studied whose review is due today or earlier */
  dueNow: number;
  reviewedToday: number;
  reviewTarget: number;
  /** new cards waiting in the deck */
  newWaiting: number;
  newIntroducedToday: number;
  newPerDay: number;
  readingDone: boolean;
  readingExists: boolean;
  aiConfigured: boolean;
  grammarThisWeek: number;
  grammarPerWeek: number;
  weeklyDue: boolean;
  weakCount: number;
  /** 0 = Monday … 6 = Sunday; decides which extra practice is suggested today */
  weekday?: number;
}

export type StepKey = "weekly" | "review" | "new" | "reading" | "weak" | "grammar" | "writing" | "listening";

/**
 * One extra practice a day, so the plan stays short: grammar, writing and listening take turns.
 * Grammar gives way to writing once this week's lessons are done.
 */
export function extraOfTheDay(weekday: number, grammarLeft: boolean): "grammar" | "writing" | "listening" {
  const slot = ((weekday % 3) + 3) % 3;
  if (slot === 2) return "listening";
  if (slot === 1) return "writing";
  return grammarLeft ? "grammar" : "writing";
}

export interface PlanStep {
  key: StepKey;
  title: string;
  detail: string;
  href: string;
  done: boolean;
  /** optional steps do not block "day complete" */
  optional: boolean;
  minutes: number;
  /** how many cards are left in this step, when that makes sense */
  count?: number;
}

export function buildDailySteps(input: PlanInput): PlanStep[] {
  const steps: PlanStep[] = [];
  const newLeft = Math.max(0, Math.min(input.newWaiting, input.newPerDay - input.newIntroducedToday));

  if (input.weeklyDue) {
    steps.push({
      key: "weekly",
      title: "Weekly check",
      detail: "A short test on this week's words. It sets next week's plan.",
      href: "/weekly",
      done: false,
      optional: false,
      minutes: 5,
    });
  }
  steps.push({
    key: "review",
    title: "Review due words",
    detail: input.dueNow > 0 ? `${input.dueNow} waiting` : input.reviewedToday > 0 ? "All caught up" : "Nothing due right now",
    href: "/review?today=1",
    done: input.dueNow === 0,
    optional: false,
    minutes: Math.max(1, Math.ceil(input.dueNow / 4)),
    count: input.dueNow,
  });
  steps.push({
    key: "new",
    title: "Learn new words",
    detail:
      input.newWaiting === 0 && input.newIntroducedToday < input.newPerDay
        ? "No new words waiting. Add a pack in Learn."
        : `${Math.min(input.newIntroducedToday, input.newPerDay)}/${input.newPerDay} today`,
    href: input.newWaiting === 0 ? "/learn" : "/review?today=1",
    done: input.newIntroducedToday >= input.newPerDay || (newLeft === 0 && input.newIntroducedToday > 0),
    optional: false,
    minutes: Math.ceil(newLeft * 0.6),
    count: newLeft,
  });
  steps.push({
    key: "reading",
    title: "Read today's text",
    detail: input.readingDone
      ? "Done"
      : !input.aiConfigured
        ? "Needs an AI key (see Settings)"
        : input.readingExists
          ? "Text is ready"
          : "A short story with your words",
    href: "/reading",
    done: input.readingDone,
    optional: !input.aiConfigured,
    minutes: 5,
  });
  if (input.weakCount > 0) {
    steps.push({
      key: "weak",
      title: "Fix weak words",
      detail: `${input.weakCount} word${input.weakCount === 1 ? "" : "s"} you keep forgetting`,
      href: "/review?weak=1",
      done: false,
      optional: true,
      minutes: Math.max(1, Math.ceil(input.weakCount / 3)),
    });
  }
  const grammarLeft = input.grammarThisWeek < input.grammarPerWeek;
  const extra = extraOfTheDay(input.weekday ?? 0, grammarLeft);
  if (extra === "grammar") {
    steps.push({
      key: "grammar",
      title: "Grammar lesson",
      detail: `${Math.min(input.grammarThisWeek, input.grammarPerWeek)}/${input.grammarPerWeek} this week`,
      href: "/tutor?tab=lessons",
      done: false,
      optional: true,
      minutes: 6,
    });
  } else if (extra === "writing") {
    steps.push({
      key: "writing",
      title: "Write 2–3 sentences",
      detail: input.aiConfigured ? "Your teacher corrects them" : "Needs an AI key (see Settings)",
      href: "/tutor?tab=write",
      done: false,
      optional: true,
      minutes: 4,
    });
  } else {
    steps.push({
      key: "listening",
      title: "Listening round",
      detail: "Hear 10 words, type what you hear",
      href: "/listen",
      done: false,
      optional: true,
      minutes: 3,
    });
  }
  return steps;
}

export function dayComplete(steps: PlanStep[]): boolean {
  return steps.filter((s) => !s.optional).every((s) => s.done);
}

export function minutesLeft(steps: PlanStep[]): number {
  return steps.filter((s) => !s.done && !s.optional).reduce((sum, s) => sum + s.minutes, 0);
}

/* ------------------------------------------------------------------ weak words */

export interface WeakCandidate {
  reviewCount: number;
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
  intervalMinutes: number;
}

/**
 * A "weak" word (leech): seen several times, failed at least 3 times, right less than
 * 60% of the time, and still not on a long interval. These get extra work.
 */
export function isWeakWord(word: WeakCandidate): boolean {
  if (word.reviewCount < 4 || word.againCount < 3) return false;
  if (word.intervalMinutes >= 7 * 24 * 60) return false;
  return (word.goodCount + word.easyCount) / word.reviewCount < 0.6;
}

/* ------------------------------------------------------------------ weekly adjustment */

export interface AdjustInput {
  /** share of right answers in the weekly check, 0..1 */
  accuracy: number;
  /** days with study in the last 7 */
  activeDays: number;
  /** due cards not reviewed yet when the check was taken */
  backlog: number;
  weakCount: number;
  newPerDay: number;
  minutes: DailyMinutes;
}

export type AdjustReason = "raise" | "keep" | "keep-irregular" | "lower-accuracy" | "lower-backlog";

export interface Adjustment {
  newPerDay: number;
  delta: number;
  reason: AdjustReason;
  message: string;
}

export function adjustPlan(input: AdjustInput): Adjustment {
  const preset = PLAN_PRESETS[input.minutes];
  const clamp = (n: number) => Math.max(MIN_NEW_WORDS, Math.min(preset.maxNewWords, n));
  const result = (target: number, reason: AdjustReason, message: string): Adjustment => {
    const newPerDay = clamp(target);
    return { newPerDay, delta: newPerDay - input.newPerDay, reason, message };
  };
  const pct = Math.round(input.accuracy * 100);

  if (input.accuracy < 0.6) {
    return result(
      input.newPerDay - 2,
      "lower-accuracy",
      `${pct}% right. Too many words are slipping, so fewer new words next week and more time on the ones you missed.`,
    );
  }
  if (input.backlog > preset.reviewTarget * 2) {
    return result(
      input.newPerDay - 1,
      "lower-backlog",
      `${pct}% right, but ${input.backlog} reviews are waiting. Slightly fewer new words until the pile is gone.`,
    );
  }
  if (input.accuracy >= 0.85 && input.activeDays >= 5 && input.weakCount <= 5) {
    return result(input.newPerDay + 1, "raise", `${pct}% right and ${input.activeDays} study days. You can take a little more.`);
  }
  if (input.accuracy >= 0.85 && input.activeDays < 5) {
    return result(
      input.newPerDay,
      "keep-irregular",
      `${pct}% right, but only ${input.activeDays} study days this week. Same load. Short daily sessions beat long rare ones.`,
    );
  }
  return result(input.newPerDay, "keep", `${pct}% right. The load is about right, keep it for another week.`);
}
