import { describe, expect, it } from "vitest";
import {
  formatInterval,
  isValidVocabId,
  vocabStatusLabel,
  wordDetailStats,
} from "../lib/vocab-detail";
import { DAY } from "../lib/srs";

describe("vocab detail API helpers", () => {
  it("rejects invalid ids", () => {
    expect(isValidVocabId("")).toBe(false);
    expect(isValidVocabId("../secret")).toBe(false);
    expect(isValidVocabId("short")).toBe(false);
    expect(isValidVocabId("clxyz1234567890")).toBe(true);
  });

  it("maps learning state to useful status labels", () => {
    expect(vocabStatusLabel("new", 0)).toBe("New");
    expect(vocabStatusLabel("learning", 10)).toBe("Learning");
    expect(vocabStatusLabel("learning", DAY)).toBe("Review");
    expect(vocabStatusLabel("learned", 4 * DAY)).toBe("Learned");
  });

  it("computes correct/incorrect counts and success rate", () => {
    expect(wordDetailStats({
      reviewCount: 0,
      againCount: 0,
      hardCount: 0,
      goodCount: 0,
      easyCount: 0,
    })).toEqual({ totalReviews: 0, correct: 0, incorrect: 0, successRate: null });
    expect(wordDetailStats({
      reviewCount: 5,
      againCount: 1,
      hardCount: 1,
      goodCount: 2,
      easyCount: 1,
    })).toEqual({ totalReviews: 5, correct: 3, incorrect: 2, successRate: 0.6 });
  });

  it("formats intervals for display", () => {
    expect(formatInterval(1)).toBe("1 min");
    expect(formatInterval(120)).toBe("2 hr");
    expect(formatInterval(DAY)).toBe("1 day");
    expect(formatInterval(2 * DAY)).toBe("2 days");
  });
});
