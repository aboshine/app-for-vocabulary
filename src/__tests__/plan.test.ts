import { describe, expect, it } from "vitest";
import { addDays, dayKey, startOfLocalDay, weekdayIndex, weekStart } from "../lib/day";
import { adjustPlan, buildDailySteps, computeStreak, dayComplete, isWeakWord, minutesLeft, weekDots, type PlanInput } from "../lib/plan";
import { advanceQueue, MAX_SESSION_REPEATS } from "../lib/review-session";

describe("day helpers", () => {
  it("uses the learner's time zone, not UTC", () => {
    // 2026-11-16 20:00 UTC is already Nov 17 in Seoul
    const date = new Date("2026-11-16T20:00:00Z");
    expect(dayKey(date, "Asia/Seoul")).toBe("2026-11-17");
    expect(startOfLocalDay(date, "Asia/Seoul").toISOString()).toBe("2026-11-16T15:00:00.000Z");
  });

  it("shifts days and finds Monday", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekdayIndex("2026-11-16")).toBe(0); // a Monday
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
  });
});

describe("streak", () => {
  it("counts back from today when today is done", () => {
    const s = computeStreak(["2026-11-14", "2026-11-15", "2026-11-16"], "2026-11-16");
    expect(s).toMatchObject({ current: 3, todayDone: true, atRisk: false });
  });

  it("keeps yesterday's streak alive but at risk until today is done", () => {
    const s = computeStreak(["2026-11-14", "2026-11-15"], "2026-11-16");
    expect(s).toMatchObject({ current: 2, todayDone: false, atRisk: true });
  });

  it("resets after a missed day and remembers the best run", () => {
    const s = computeStreak(["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-16"], "2026-11-16");
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
  });

  it("marks the week", () => {
    const dots = weekDots(["2026-11-16"], "2026-11-17");
    expect(dots.map((d) => d.active)).toEqual([true, false, false, false, false, false, false]);
    expect(dots[1].today).toBe(true);
    expect(dots[2].future).toBe(true);
  });
});

const base: PlanInput = {
  dueNow: 12,
  reviewedToday: 0,
  reviewTarget: 20,
  newWaiting: 30,
  newIntroducedToday: 0,
  newPerDay: 5,
  readingDone: false,
  readingExists: false,
  aiConfigured: true,
  grammarThisWeek: 0,
  grammarPerWeek: 2,
  weeklyDue: false,
  weakCount: 0,
};

describe("daily steps", () => {
  it("lists review, new words, reading and an optional grammar lesson", () => {
    const steps = buildDailySteps(base);
    expect(steps.map((s) => s.key)).toEqual(["review", "new", "reading", "grammar"]);
    expect(dayComplete(steps)).toBe(false);
    expect(minutesLeft(steps)).toBeGreaterThan(0);
  });

  it("is complete when the required steps are done, even with optional ones open", () => {
    const steps = buildDailySteps({ ...base, dueNow: 0, reviewedToday: 17, newIntroducedToday: 5, readingDone: true, weakCount: 3 });
    expect(steps.find((s) => s.key === "weak")?.optional).toBe(true);
    expect(dayComplete(steps)).toBe(true);
    expect(minutesLeft(steps)).toBe(0);
  });

  it("puts the weekly check first when it is due", () => {
    expect(buildDailySteps({ ...base, weeklyDue: true })[0].key).toBe("weekly");
  });

  it("does not block the day on reading when AI is not set up", () => {
    const steps = buildDailySteps({ ...base, aiConfigured: false, dueNow: 0, newIntroducedToday: 5 });
    expect(dayComplete(steps)).toBe(true);
  });

  it("sends the learner to Learn when no new words are waiting", () => {
    const step = buildDailySteps({ ...base, newWaiting: 0 }).find((s) => s.key === "new")!;
    expect(step.href).toBe("/learn");
    expect(step.done).toBe(false);
  });
});

describe("weak words", () => {
  const word = { reviewCount: 8, againCount: 4, hardCount: 1, goodCount: 3, easyCount: 0, intervalMinutes: 600 };
  it("flags words that keep failing", () => expect(isWeakWord(word)).toBe(true));
  it("ignores words with few reviews or few failures", () => {
    expect(isWeakWord({ ...word, reviewCount: 3 })).toBe(false);
    expect(isWeakWord({ ...word, againCount: 2 })).toBe(false);
  });
  it("lets a word go once it is mostly right or on a long interval", () => {
    expect(isWeakWord({ ...word, reviewCount: 12, goodCount: 8 })).toBe(false);
    expect(isWeakWord({ ...word, intervalMinutes: 8 * 24 * 60 })).toBe(false);
  });
});

describe("weekly plan adjustment", () => {
  const input = { accuracy: 0.9, activeDays: 6, backlog: 0, weakCount: 0, newPerDay: 5, minutes: 15 as const };
  it("raises the load after a strong, regular week", () => {
    expect(adjustPlan(input)).toMatchObject({ newPerDay: 6, delta: 1, reason: "raise" });
  });
  it("never goes above the cap for the time budget", () => {
    expect(adjustPlan({ ...input, newPerDay: 8 })).toMatchObject({ newPerDay: 8, delta: 0 });
  });
  it("keeps the load when the score is good but study days were few", () => {
    expect(adjustPlan({ ...input, activeDays: 3 })).toMatchObject({ delta: 0, reason: "keep-irregular" });
  });
  it("lowers the load after a weak result, but not below the minimum", () => {
    expect(adjustPlan({ ...input, accuracy: 0.5 })).toMatchObject({ newPerDay: 3, reason: "lower-accuracy" });
    expect(adjustPlan({ ...input, accuracy: 0.5, newPerDay: 2 }).newPerDay).toBe(2);
  });
  it("lowers the load when reviews pile up", () => {
    expect(adjustPlan({ ...input, backlog: 60 })).toMatchObject({ newPerDay: 4, reason: "lower-backlog" });
  });
  it("keeps the load in the middle", () => {
    expect(adjustPlan({ ...input, accuracy: 0.7 })).toMatchObject({ delta: 0, reason: "keep" });
  });
});

describe("advanceQueue", () => {
  const queue = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
  it("drops a card that was answered", () => {
    expect(advanceQueue(queue, "good", new Map()).map((c) => c.id)).toEqual(["b", "c", "d", "e"]);
  });
  it("brings a missed card back a few cards later", () => {
    expect(advanceQueue(queue, "again", new Map()).map((c) => c.id)).toEqual(["b", "c", "d", "a", "e"]);
  });
  it("keeps a missed last card in the queue", () => {
    expect(advanceQueue([{ id: "a" }], "again", new Map()).map((c) => c.id)).toEqual(["a"]);
  });
  it("stops repeating after the limit so a session always ends", () => {
    const repeats = new Map<string, number>();
    let q = [{ id: "a" }];
    for (let i = 0; i < MAX_SESSION_REPEATS; i += 1) q = advanceQueue(q, "again", repeats);
    expect(q).toHaveLength(1);
    expect(advanceQueue(q, "again", repeats)).toHaveLength(0);
  });
});
