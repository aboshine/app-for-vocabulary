import { describe, expect, it } from "vitest";
import {
  isTypingAnswerCorrect,
  normalizeReviewAnswer,
  typingReviewPayload,
} from "../lib/review-modes";
import { DIRECTIONS } from "../lib/srs";

describe("answer normalization", () => {
  it("trims whitespace and collapses repeated spaces", () => {
    expect(normalizeReviewAnswer("  물  ")).toBe("물");
    expect(normalizeReviewAnswer("한   잔")).toBe("한 잔");
    expect(normalizeReviewAnswer("\n안녕하세요\t")).toBe("안녕하세요");
  });

  it("compares NFC-normalized strings consistently", () => {
    const nfc = "가";
    const nfd = nfc.normalize("NFD");
    expect(nfd).not.toBe(nfc);
    expect(isTypingAnswerCorrect(nfd, nfc)).toBe(true);
  });
});

describe("correct/incorrect comparison", () => {
  it("accepts an exact Korean match after normalization", () => {
    expect(isTypingAnswerCorrect("물", "물")).toBe(true);
    expect(isTypingAnswerCorrect("  물   ", "물")).toBe(true);
    expect(isTypingAnswerCorrect("한   잔", "한 잔")).toBe(true);
  });

  it("rejects a different word without fuzzy matching", () => {
    expect(isTypingAnswerCorrect("물", "불")).toBe(false);
    expect(isTypingAnswerCorrect("물요", "물")).toBe(false);
    expect(isTypingAnswerCorrect("", "물")).toBe(false);
  });
});

describe("typing review persistence", () => {
  it("saves reviews with mode/direction typing", () => {
    expect(DIRECTIONS).toContain("typing");
    expect(typingReviewPayload("word-1", "good")).toEqual({
      vocabularyId: "word-1",
      rating: "good",
      direction: "typing",
    });
  });
});
