import { describe, expect, it } from "vitest";
import { computeDashboardStats, filterDueQueue } from "../lib/review";
import { endOfDay } from "../lib/srs";
import { matchesSearch, parseLearningState, parseVocabInput } from "../lib/validation";

describe("filterDueQueue", () => {
  const now = new Date("2026-09-19T12:00:00.000Z");

  it("returns only due cards, earliest first", () => {
    const queue = filterDueQueue(
      [
        { id: "later", nextReviewAt: new Date("2026-09-20T00:00:00.000Z") },
        { id: "oldest", nextReviewAt: new Date("2026-09-19T08:00:00.000Z") },
        { id: "due", nextReviewAt: now },
      ],
      now,
    );
    expect(queue.map((item) => item.id)).toEqual(["oldest", "due"]);
  });

  it("returns an empty queue when nothing is due", () => {
    const queue = filterDueQueue(
      [{ id: "future", nextReviewAt: new Date("2026-09-19T13:00:00.000Z") }],
      now,
    );
    expect(queue).toEqual([]);
  });
});

describe("computeDashboardStats", () => {
  const now = new Date("2026-09-19T12:00:00.000Z");

  it("counts totals, states, due today, and today's reviews", () => {
    const laterToday = new Date(endOfDay(now).getTime() - 60_000);
    const afterToday = new Date(endOfDay(now).getTime() + 60_000);
    const stats = computeDashboardStats(
      [
        { learningState: "new", nextReviewAt: now },
        { learningState: "learning", nextReviewAt: laterToday },
        { learningState: "learned", nextReviewAt: afterToday },
      ],
      4,
      now,
    );
    expect(stats).toEqual({
      total: 3,
      new: 1,
      learning: 1,
      learned: 1,
      dueToday: 2,
      reviewsToday: 4,
    });
  });
});

describe("matchesSearch", () => {
  const word = { korean: "안녕하세요", meaning: "Hello" };

  it("matches Korean and meaning case-insensitively", () => {
    expect(matchesSearch(word, "안녕")).toBe(true);
    expect(matchesSearch(word, "HELLO")).toBe(true);
    expect(matchesSearch(word, "  hello ")).toBe(true);
    expect(matchesSearch(word, "water")).toBe(false);
  });
});

describe("parseLearningState", () => {
  it("ignores invalid filter states", () => {
    expect(parseLearningState("learning")).toBe("learning");
    expect(parseLearningState("nope")).toBeUndefined();
    expect(parseLearningState(null)).toBeUndefined();
  });
});

describe("parseVocabInput", () => {
  it("requires korean and meaning after trim", () => {
    expect(parseVocabInput({ korean: "  ", meaning: "hi" })).toBe("Korean and meaning are required.");
    const parsed = parseVocabInput({ korean: " 물 ", meaning: " water ", categoryId: "" });
    expect(parsed).toMatchObject({ korean: "물", meaning: "water", categoryId: null });
  });
});
