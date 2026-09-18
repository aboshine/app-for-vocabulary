import { describe, expect, it } from "vitest";
import {
  accuracyFromCounts,
  accuracyFromRatings,
  assembleCategoryProgress,
  rankDifficultWords,
  remainingToday,
} from "../lib/dashboard";

describe("dashboard calculations", () => {
  it("computes accuracy only when enough reviews exist", () => {
    expect(accuracyFromRatings(["good", "easy", "hard", "again"])).toBeNull();
    expect(accuracyFromRatings(["good", "good", "easy", "hard", "again"])).toBe(0.6);
    expect(accuracyFromCounts(8, 10)).toBe(0.8);
    expect(accuracyFromCounts(2, 4)).toBeNull();
  });

  it("ranks the lowest recent success rates first", () => {
    const ranked = rankDifficultWords([
      { id: "easy", korean: "학교", meaning: "school", success: 9, total: 10 },
      { id: "hard", korean: "어렵다", meaning: "difficult", success: 1, total: 6 },
      { id: "mid", korean: "물", meaning: "water", success: 3, total: 6 },
      { id: "few", korean: "하나", meaning: "one", success: 0, total: 1 },
    ]);
    expect(ranked.map((word) => word.id)).toEqual(["hard", "mid", "easy"]);
  });

  it("counts remaining cards without going below zero", () => {
    expect(remainingToday(8, 3)).toBe(5);
    expect(remainingToday(2, 5)).toBe(0);
  });

  it("aggregates category totals and learned counts", () => {
    const rows = assembleCategoryProgress(
      [
        { categoryId: "food", learningState: "new", count: 2 },
        { categoryId: "food", learningState: "learned", count: 3 },
        { categoryId: null, learningState: "learning", count: 1 },
      ],
      new Map([["food", "Food"]]),
    );
    expect(rows).toEqual([
      { id: "food", name: "Food", total: 5, learned: 3 },
      { id: null, name: "Uncategorized", total: 1, learned: 0 },
    ]);
  });
});
