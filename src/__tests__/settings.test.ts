import { describe, expect, it } from "vitest";
import {
  assignQueueModes,
  MIXED_ROTATION,
  type ReviewWord,
} from "../lib/review-modes";
import {
  DEFAULT_SETTINGS,
  parseMixedModes,
  parseSettingsInput,
  persistSettings,
  serializeMixedModes,
  sessionConfigFromSettings,
  settingsFromRow,
  settingsToRow,
} from "../lib/settings";
import {
  buildSessionQueue,
  capNewCards,
  countNewIntroducedOnDay,
  remainingNewCards,
  type SessionCard,
} from "../lib/review-session";
import { endOfDay, startOfDay } from "../lib/srs";

const now = new Date("2026-09-19T12:00:00.000Z");

function card(overrides: Partial<SessionCard> & Pick<SessionCard, "id">): SessionCard {
  return {
    korean: overrides.id,
    meaning: overrides.id,
    exampleSentence: "예시",
    exampleTranslation: "example",
    notes: "",
    categoryId: "cat-a",
    learningState: "learning",
    nextReviewAt: now,
    reviewCount: 1,
    againCount: 0,
    hardCount: 0,
    goodCount: 1,
    easyCount: 0,
    ...overrides,
  };
}

const word: ReviewWord = {
  id: "1",
  korean: "물",
  meaning: "water",
  exampleSentence: "물 한 잔 주세요.",
  exampleTranslation: "Please give me a glass of water.",
  notes: "",
};

describe("default settings", () => {
  it("uses sensible defaults for a new user", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      dailyNewWordLimit: 10,
      sessionLimit: 10,
      defaultMode: "mixed",
      mixedModes: [...MIXED_ROTATION],
      includeNew: true,
      defaultCategoryId: "",
      dailyReviewTarget: 20,
    });
  });
});

describe("persistence", () => {
  it("round-trips stored settings and applies updates", () => {
    const row = settingsToRow(DEFAULT_SETTINGS);
    expect(settingsFromRow(row)).toEqual(DEFAULT_SETTINGS);
    const next = persistSettings(DEFAULT_SETTINGS, {
      ...DEFAULT_SETTINGS,
      dailyNewWordLimit: 5,
      sessionLimit: 20,
      includeNew: false,
    });
    expect(next.dailyNewWordLimit).toBe(5);
    expect(next.sessionLimit).toBe(20);
    expect(next.includeNew).toBe(false);
    expect(parseSettingsInput({
      dailyNewWordLimit: 30,
      sessionLimit: "all",
      defaultMode: "typing",
      mixedModes: ["typing", "ko-meaning"],
      includeNew: true,
      defaultCategoryId: "food",
      dailyReviewTarget: 12,
    })).toMatchObject({
      dailyNewWordLimit: 30,
      sessionLimit: "all",
      defaultMode: "typing",
      includeNew: true,
      defaultCategoryId: "food",
      dailyReviewTarget: 12,
    });
    expect(parseMixedModes(serializeMixedModes(["typing"]))).toEqual(["typing"]);
  });
});

describe("daily new-word limit", () => {
  it("counts remaining new cards and caps them in the queue", () => {
    expect(remainingNewCards(10, 0)).toBe(10);
    expect(remainingNewCards(10, 7)).toBe(3);
    expect(remainingNewCards(10, 12)).toBe(0);
    expect(countNewIntroducedOnDay([
      startOfDay(now),
      new Date(endOfDay(now).getTime() - 1000),
      new Date(startOfDay(now).getTime() - 1000),
      null,
    ], now)).toBe(2);

    const cards = [
      card({ id: "due", nextReviewAt: now, learningState: "learning" }),
      card({ id: "n1", learningState: "new", reviewCount: 0, nextReviewAt: now }),
      card({ id: "n2", learningState: "new", reviewCount: 0, nextReviewAt: now }),
      card({ id: "n3", learningState: "new", reviewCount: 0, nextReviewAt: now }),
    ];
    expect(capNewCards(cards, 2).map((item) => item.id)).toEqual(["due", "n1", "n2"]);
    const queue = buildSessionQueue(
      cards,
      { limit: "all", categoryId: "", includeNew: true, newCardLimit: 1 },
      now,
    );
    expect(queue.filter((item) => item.learningState === "new")).toHaveLength(1);
    expect(queue.some((item) => item.id === "due")).toBe(true);
  });
});

describe("enabled review modes", () => {
  it("rotates only enabled Mixed modes", () => {
    const queue = [word, { ...word, id: "2" }, { ...word, id: "3" }];
    const modes = assignQueueModes(queue, "mixed", ["typing", "ko-meaning"]).map((item) => item.mode);
    expect(modes.every((mode) => mode === "typing" || mode === "ko-meaning")).toBe(true);
    expect(new Set(modes)).toEqual(new Set(["typing", "ko-meaning"]));
  });
});

describe("review setup using saved defaults", () => {
  it("builds a session config from persisted settings", () => {
    const config = sessionConfigFromSettings(
      {
        ...DEFAULT_SETTINGS,
        sessionLimit: 20,
        defaultMode: "sentence-production",
        defaultCategoryId: "food",
        includeNew: false,
        dailyNewWordLimit: 5,
        mixedModes: ["typing"],
      },
      2,
    );
    expect(config).toMatchObject({
      limit: 20,
      mode: "sentence-production",
      categoryId: "food",
      includeNew: false,
      newCardLimit: 3,
      mixedModes: ["typing"],
    });
  });
});
