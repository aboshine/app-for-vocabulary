import { describe, expect, it } from "vitest";
import { assignQueueModes, type ReviewWord } from "../lib/review-modes";
import {
  buildSessionQueue,
  previewSession,
  type SessionCard,
} from "../lib/review-session";
import { endOfDay, startOfDay } from "../lib/srs";

const now = new Date("2026-09-19T12:00:00.000Z");
const overdueAt = new Date(startOfDay(now).getTime() - 3_600_000);
const dueTodayAt = new Date(startOfDay(now).getTime() + 3_600_000);
const laterToday = new Date(endOfDay(now).getTime() - 3_600_000);

function card(overrides: Partial<SessionCard> & Pick<SessionCard, "id">): SessionCard {
  return {
    korean: overrides.id,
    meaning: overrides.id,
    exampleSentence: "예시 문장",
    exampleTranslation: "example",
    notes: "",
    categoryId: "cat-a",
    learningState: "learning",
    nextReviewAt: now,
    reviewCount: 4,
    againCount: 0,
    hardCount: 0,
    goodCount: 4,
    easyCount: 0,
    ...overrides,
  };
}

describe("buildSessionQueue", () => {
  it("orders overdue, due today, difficult, then new cards", () => {
    const overdue = card({
      id: "overdue",
      nextReviewAt: overdueAt,
    });
    const dueToday = card({
      id: "due-today",
      nextReviewAt: dueTodayAt,
    });
    const difficult = card({
      id: "difficult",
      nextReviewAt: laterToday,
      againCount: 5,
      hardCount: 2,
      goodCount: 0,
      reviewCount: 7,
    });
    const fresh = card({
      id: "new",
      learningState: "new",
      reviewCount: 0,
      nextReviewAt: now,
    });
    const queue = buildSessionQueue(
      [fresh, dueToday, difficult, overdue],
      { limit: "all", mode: "mixed", categoryId: "", includeNew: true },
      now,
    );
    expect(queue.map((item) => item.id)).toEqual(["overdue", "due-today", "difficult", "new"]);
  });

  it("applies session limits", () => {
    const cards = Array.from({ length: 25 }, (_, index) =>
      card({
        id: `c${String(index).padStart(2, "0")}`,
        nextReviewAt: overdueAt,
      }),
    );
    expect(buildSessionQueue(cards, { limit: 10, mode: "mixed", categoryId: "", includeNew: true }, now)).toHaveLength(10);
    expect(buildSessionQueue(cards, { limit: 20, mode: "mixed", categoryId: "", includeNew: true }, now)).toHaveLength(20);
    expect(buildSessionQueue(cards, { limit: 30, mode: "mixed", categoryId: "", includeNew: true }, now)).toHaveLength(25);
    expect(buildSessionQueue(cards, { limit: "all", mode: "mixed", categoryId: "", includeNew: true }, now)).toHaveLength(25);
  });

  it("filters by category", () => {
    const queue = buildSessionQueue(
      [
        card({ id: "a", categoryId: "food", nextReviewAt: overdueAt }),
        card({ id: "b", categoryId: "work", nextReviewAt: overdueAt }),
      ],
      { limit: "all", mode: "mixed", categoryId: "food", includeNew: true },
      now,
    );
    expect(queue.map((item) => item.id)).toEqual(["a"]);
  });

  it("excludes new cards when includeNew is false", () => {
    const queue = buildSessionQueue(
      [
        card({ id: "old", nextReviewAt: overdueAt }),
        card({ id: "fresh", learningState: "new", reviewCount: 0, nextReviewAt: now }),
      ],
      { limit: "all", mode: "mixed", categoryId: "", includeNew: false },
      now,
    );
    expect(queue.map((item) => item.id)).toEqual(["old"]);
  });

  it("does not repeat the same vocabulary id in one session", () => {
    const duplicate = card({ id: "same", nextReviewAt: overdueAt });
    const queue = buildSessionQueue(
      [duplicate, { ...duplicate }],
      { limit: "all", mode: "mixed", categoryId: "", includeNew: true },
      now,
    );
    expect(queue.map((item) => item.id)).toEqual(["same"]);
  });

  it("reports preview counts and estimated session size", () => {
    const preview = previewSession(
      [
        card({ id: "overdue", nextReviewAt: overdueAt }),
        card({ id: "today", nextReviewAt: laterToday }),
        card({ id: "fresh", learningState: "new", reviewCount: 0, nextReviewAt: now }),
      ],
      { limit: 10, mode: "mixed", categoryId: "", includeNew: true },
      now,
    );
    expect(preview).toEqual({ overdue: 1, due: 2, new: 1, estimated: 3 });
  });
});

describe("mixed mode session distribution", () => {
  it("rotates recall modes across the session", () => {
    const words: ReviewWord[] = Array.from({ length: 6 }, (_, index) => ({
      id: String(index),
      korean: "물",
      meaning: "water",
      exampleSentence: "물 한 잔 주세요.",
      exampleTranslation: "Please give me a glass of water.",
      notes: "",
    }));
    expect(assignQueueModes(words, "mixed").map((item) => item.mode)).toEqual([
      "ko-meaning",
      "meaning-ko",
      "sentence-meaning",
      "sentence-completion",
      "sentence-production",
      "typing",
    ]);
  });
});
