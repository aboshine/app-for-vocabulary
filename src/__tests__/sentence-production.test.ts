import { describe, expect, it } from "vitest";
import {
  availableModes,
  blankTargetWord,
  buildPrompt,
  isTypingAnswerCorrect,
  pickReviewMode,
  sentenceProductionPrompt,
  typedReviewPayload,
  type ReviewWord,
} from "../lib/review-modes";
import { DIRECTIONS } from "../lib/srs";

const word: ReviewWord = {
  id: "1",
  korean: "가요",
  meaning: "go",
  exampleSentence: "저는 학교에 가요.",
  exampleTranslation: "I go to school.",
  notes: "",
};

const noSentence: ReviewWord = {
  ...word,
  id: "2",
  exampleSentence: "",
  exampleTranslation: "",
};

describe("target-word replacement", () => {
  it("replaces the vocabulary form with a blank in the example sentence", () => {
    expect(blankTargetWord("저는 학교에 가요.", "가요")).toBe("저는 학교에 _____.");
    expect(blankTargetWord(word.exampleSentence, word.korean)).toBe("저는 학교에 _____.");
  });

  it("builds a sentence-production prompt from the blanked sentence", () => {
    const prompt = buildPrompt(word, "sentence-production");
    expect(prompt.prompt).toBe("저는 학교에 _____.");
    expect(prompt.answer).toBe("가요");
    expect(prompt.originalSentence).toBe("저는 학교에 가요.");
    expect(prompt.translationHint).toBe("I go to school.");
  });
});

describe("missing example sentence", () => {
  it("excludes sentence-production when no example exists", () => {
    expect(sentenceProductionPrompt(noSentence)).toBeNull();
    expect(availableModes(noSentence, "sentence-production")).toEqual(["ko-meaning"]);
    expect(pickReviewMode(noSentence, "sentence-production", 0)).toBe("ko-meaning");
    expect(availableModes(noSentence, "mixed")).not.toContain("sentence-production");
  });
});

describe("answer validation", () => {
  it("reuses typing normalization for the missing word", () => {
    expect(isTypingAnswerCorrect("  가요  ", word.korean)).toBe(true);
    expect(isTypingAnswerCorrect("가요요", word.korean)).toBe(false);
  });
});

describe("review persistence", () => {
  it("saves reviews with mode sentence-production", () => {
    expect(DIRECTIONS).toContain("sentence-production");
    expect(typedReviewPayload("word-1", "good", "sentence-production")).toEqual({
      vocabularyId: "word-1",
      rating: "good",
      direction: "sentence-production",
    });
  });
});
