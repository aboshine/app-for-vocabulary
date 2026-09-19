import { describe, expect, it } from "vitest";
import {
  assignQueueModes,
  availableModes,
  blankTargetWord,
  buildPrompt,
  pickReviewMode,
  type ReviewWord,
} from "../lib/review-modes";

const word: ReviewWord = {
  id: "1",
  korean: "물",
  meaning: "water",
  exampleSentence: "물 한 잔 주세요.",
  exampleTranslation: "Please give me a glass of water.",
  notes: "",
};

const noSentence: ReviewWord = { ...word, id: "2", exampleSentence: "", exampleTranslation: "" };

describe("blankTargetWord", () => {
  it("replaces the target Korean word with a blank", () => {
    expect(blankTargetWord("물 한 잔 주세요.", "물")).toBe("_____ 한 잔 주세요.");
    expect(blankTargetWord("저는 물을 마셔요.", "물")).toBe("저는 _____을 마셔요.");
  });

  it("falls back when the word is not in the sentence", () => {
    expect(blankTargetWord("안녕하세요.", "물")).toBe("_____ 안녕하세요.");
  });
});

describe("pickReviewMode", () => {
  it("honors a locked Korean → meaning filter", () => {
    expect(pickReviewMode(word, "ko-meaning", 3)).toBe("ko-meaning");
    expect(availableModes(word, "meaning-ko")).toEqual(["meaning-ko"]);
  });

  it("uses sentence modes when the Sentence filter is selected", () => {
    expect(availableModes(word, "sentence")).toEqual(["sentence-meaning", "sentence-completion"]);
    expect(pickReviewMode(word, "sentence", 0)).toBe("sentence-meaning");
    expect(pickReviewMode(word, "sentence", 1)).toBe("sentence-completion");
  });

  it("falls back from Sentence mode when no example exists", () => {
    expect(availableModes(noSentence, "sentence")).toEqual(["ko-meaning"]);
  });

  it("distributes Mixed modes instead of repeating one mode", () => {
    const queue = [
      word,
      word,
      { ...word, id: "3" },
      { ...word, id: "4" },
      { ...word, id: "5" },
      { ...word, id: "6" },
    ];
    const modes = assignQueueModes(queue, "mixed").map((item) => item.mode);
    expect(new Set(modes).size).toBeGreaterThan(1);
    expect(modes).toEqual([
      "ko-meaning",
      "meaning-ko",
      "sentence-meaning",
      "sentence-completion",
      "sentence-production",
      "typing",
    ]);
    expect(modes).toContain("sentence-production");
  });

  it("keeps Mixed mode limited when a card has no sentence", () => {
    expect(availableModes(noSentence, "mixed")).toEqual(["ko-meaning", "meaning-ko", "typing"]);
    expect(availableModes(noSentence, "mixed")).not.toContain("sentence-production");
    expect(pickReviewMode(noSentence, "mixed", 0)).toBe("ko-meaning");
    expect(pickReviewMode(noSentence, "mixed", 1)).toBe("meaning-ko");
    expect(pickReviewMode(noSentence, "mixed", 2)).toBe("typing");
  });

  it("locks the Typing filter", () => {
    expect(availableModes(word, "typing")).toEqual(["typing"]);
    expect(pickReviewMode(word, "typing", 4)).toBe("typing");
  });
});

describe("buildPrompt", () => {
  it("builds a sentence-completion prompt from the blanked sentence", () => {
    const prompt = buildPrompt(word, "sentence-completion");
    expect(prompt.prompt).toBe("_____ 한 잔 주세요.");
    expect(prompt.answer).toBe("물 한 잔 주세요.");
  });

  it("shows the meaning and expects the Korean word in Typing mode", () => {
    const prompt = buildPrompt(word, "typing");
    expect(prompt.prompt).toBe("water");
    expect(prompt.answer).toBe("물");
    expect(prompt.hint).toBe("Type the Korean");
  });
});
