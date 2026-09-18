import { describe, expect, it } from "vitest";
import {
  appendReviewHistory,
  applyGrammarReview,
  createGrammarRecord,
  deleteGrammarById,
  filterGrammarRecords,
  grammarReviewStats,
  updateGrammarRecord,
} from "../lib/grammar";
import { buildSessionQueue, previewSession, type SessionSrsFields } from "../lib/review-session";
import { DAY, endOfDay, startOfDay } from "../lib/srs";
import { parseGrammarInput, parseStoredExamples } from "../lib/validation";

const now = new Date("2026-09-19T12:00:00.000Z");
const overdueAt = new Date(startOfDay(now).getTime() - 3_600_000);
const dueTodayAt = new Date(startOfDay(now).getTime() + 3_600_000);
const laterToday = new Date(endOfDay(now).getTime() - 3_600_000);

function grammarCard(
  overrides: Partial<SessionSrsFields> & Pick<SessionSrsFields, "id">,
): SessionSrsFields {
  return {
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

describe("grammar CRUD", () => {
  it("creates a grammar record with new learning state and empty review stats", () => {
    const created = createGrammarRecord(
      {
        title: "-고 싶다",
        meaning: "to want to",
        explanation: "desire",
        structure: "V-고 싶다",
        examples: [{ sentence: "가고 싶어요.", translation: "I want to go." }],
        notes: "",
        categoryId: "everyday",
        tags: "desire",
      },
      now,
      "g1",
    );
    expect(created).toMatchObject({
      id: "g1",
      title: "-고 싶다",
      learningState: "new",
      reviewCount: 0,
      intervalMinutes: 0,
      lastReviewedAt: null,
    });
  });

  it("updates content without resetting review stats", () => {
    const created = createGrammarRecord(
      {
        title: "old",
        meaning: "old meaning",
        explanation: "",
        structure: "",
        examples: [],
        notes: "",
        categoryId: null,
        tags: "",
      },
      now,
      "g1",
    );
    const reviewed = { ...created, ...applyGrammarReview(created, "good", now) };
    const updated = updateGrammarRecord(
      reviewed,
      {
        title: "-아/어요",
        meaning: "polite present",
        explanation: "ending",
        structure: "V-아/어요",
        examples: [],
        notes: "note",
        categoryId: "greetings",
        tags: "conjugation",
      },
      now,
    );
    expect(updated.title).toBe("-아/어요");
    expect(updated.reviewCount).toBe(1);
    expect(updated.learningState).toBe("learning");
  });

  it("deletes grammar by id", () => {
    const remaining = deleteGrammarById(
      [{ id: "keep" }, { id: "drop" }],
      "drop",
    );
    expect(remaining.map((item) => item.id)).toEqual(["keep"]);
  });

  it("requires title and meaning when parsing create/edit payloads", () => {
    expect(parseGrammarInput({ title: "  ", meaning: "x" })).toBe("Title and meaning are required.");
    const parsed = parseGrammarInput({
      title: " -고 싶다 ",
      meaning: " want ",
      examples: [{ sentence: "가고 싶어요.", translation: "I want to go." }],
      categoryId: "",
    });
    expect(parsed).toMatchObject({
      title: "-고 싶다",
      meaning: "want",
      categoryId: null,
      examples: [{ sentence: "가고 싶어요.", translation: "I want to go." }],
    });
  });
});

describe("grammar filters", () => {
  const items = [
    {
      title: "-고 싶다",
      meaning: "to want to",
      explanation: "desire",
      structure: "V-고 싶다",
      tags: "desire",
      categoryId: "everyday",
      learningState: "new",
    },
    {
      title: "-아/어요",
      meaning: "polite present",
      explanation: "ending",
      structure: "V-아/어요",
      tags: "conjugation",
      categoryId: "greetings",
      learningState: "learning",
    },
  ];

  it("filters by search, category, and learning state", () => {
    expect(filterGrammarRecords(items, { q: "want" }).map((item) => item.title)).toEqual(["-고 싶다"]);
    expect(filterGrammarRecords(items, { q: "아/어" }).map((item) => item.title)).toEqual(["-아/어요"]);
    expect(filterGrammarRecords(items, { categoryId: "greetings" }).map((item) => item.title)).toEqual(["-아/어요"]);
    expect(filterGrammarRecords(items, { state: "new" }).map((item) => item.title)).toEqual(["-고 싶다"]);
    expect(filterGrammarRecords(items, { state: "nope" })).toHaveLength(2);
  });
});

describe("grammar review queue", () => {
  it("orders overdue, due today, difficult, then new grammar cards", () => {
    const queue = buildSessionQueue(
      [
        grammarCard({ id: "new", learningState: "new", reviewCount: 0, nextReviewAt: now }),
        grammarCard({ id: "due-today", nextReviewAt: dueTodayAt }),
        grammarCard({
          id: "difficult",
          nextReviewAt: laterToday,
          againCount: 5,
          hardCount: 2,
          goodCount: 0,
          reviewCount: 7,
        }),
        grammarCard({ id: "overdue", nextReviewAt: overdueAt }),
      ],
      { limit: "all", categoryId: "", includeNew: true },
      now,
    );
    expect(queue.map((item) => item.id)).toEqual(["overdue", "due-today", "difficult", "new"]);
  });

  it("applies 10/20/30/all limits and due/new filtering", () => {
    const cards = Array.from({ length: 25 }, (_, index) =>
      grammarCard({ id: `g${String(index).padStart(2, "0")}`, nextReviewAt: overdueAt }),
    );
    expect(buildSessionQueue(cards, { limit: 10, categoryId: "", includeNew: true }, now)).toHaveLength(10);
    expect(buildSessionQueue(cards, { limit: 20, categoryId: "", includeNew: true }, now)).toHaveLength(20);
    expect(buildSessionQueue(cards, { limit: 30, categoryId: "", includeNew: true }, now)).toHaveLength(25);
    expect(buildSessionQueue(cards, { limit: "all", categoryId: "", includeNew: true }, now)).toHaveLength(25);

    const mixed = [
      grammarCard({ id: "old", nextReviewAt: overdueAt }),
      grammarCard({ id: "fresh", learningState: "new", reviewCount: 0, nextReviewAt: now }),
    ];
    expect(buildSessionQueue(mixed, { limit: "all", categoryId: "", includeNew: false }, now).map((item) => item.id)).toEqual(["old"]);
    expect(buildSessionQueue(mixed, { limit: "all", categoryId: "food", includeNew: true }, now)).toEqual([]);
  });

  it("previews due/new counts without refetching after ratings", () => {
    const cards = [
      grammarCard({ id: "overdue", nextReviewAt: overdueAt }),
      grammarCard({ id: "today", nextReviewAt: laterToday }),
      grammarCard({ id: "fresh", learningState: "new", reviewCount: 0, nextReviewAt: now }),
    ];
    const config = { limit: 10 as const, categoryId: "", includeNew: true };
    expect(previewSession(cards, config, now)).toEqual({ overdue: 1, due: 2, new: 1, estimated: 3 });
    const remaining = cards.slice(1);
    expect(remaining.map((item) => item.id)).toEqual(["today", "fresh"]);
    expect(previewSession(cards, config, now).estimated).toBe(3);
  });
});

describe("grammar SRS integration", () => {
  it("uses the replaceable scheduler and stores review history", () => {
    const card = createGrammarRecord(
      {
        title: "-고 싶다",
        meaning: "to want to",
        explanation: "",
        structure: "V-고 싶다",
        examples: [],
        notes: "",
        categoryId: null,
        tags: "",
      },
      now,
      "g1",
    );
    const applied = applyGrammarReview(card, "good", now);
    expect(applied.intervalMinutes).toBe(DAY);
    expect(applied.learningState).toBe("learning");
    expect(applied.reviewCount).toBe(1);
    expect(applied.goodCount).toBe(1);
    expect(applied.historyEntry).toMatchObject({
      rating: "good",
      intervalBefore: 0,
      intervalAfter: DAY,
    });
    const history = appendReviewHistory([], applied.historyEntry);
    expect(history).toHaveLength(1);

    const easy = applyGrammarReview({ ...card, ...applied }, "easy", now);
    expect(easy.intervalMinutes).toBe(4 * DAY);
    expect(easy.learningState).toBe("learned");
    expect(easy.easyCount).toBe(1);
  });
});

describe("grammar review statistics", () => {
  it("computes success rate from rating counts", () => {
    expect(
      grammarReviewStats({
        reviewCount: 0,
        againCount: 0,
        hardCount: 0,
        goodCount: 0,
        easyCount: 0,
      }),
    ).toEqual({ totalReviews: 0, correct: 0, incorrect: 0, successRate: null });
    expect(
      grammarReviewStats({
        reviewCount: 5,
        againCount: 1,
        hardCount: 1,
        goodCount: 2,
        easyCount: 1,
      }),
    ).toEqual({ totalReviews: 5, correct: 3, incorrect: 2, successRate: 0.6 });
  });

  it("parses stored example sentences", () => {
    expect(parseStoredExamples('[{"sentence":"가요.","translation":"I go."}]')).toEqual([
      { sentence: "가요.", translation: "I go." },
    ]);
    expect(parseStoredExamples("not-json")).toEqual([]);
  });
});
