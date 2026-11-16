import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { GRAMMAR_SYLLABUS, nextSyllabusItem } from "../data/grammar-syllabus";
import { parseAiSettings } from "../lib/ai-settings";
import { mockResponse } from "../lib/ai/mock";
import {
  chatPrompt,
  cleanChat,
  explainPrompt,
  lessonPrompt,
  teacherVoice,
  validateExplain,
  validateLesson,
  validateWordHelp,
  wordHelpPrompt,
} from "../lib/ai/tutor-prompts";
import { latestChatId, reminderText } from "../lib/telegram";
import { buildWeeklyQuestions, gradeWeekly, pickWeeklyWords, publicQuestions, weeklyIsDue, type WeeklyWord } from "../lib/weekly";

const NOW = new Date("2026-11-16T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function word(i: number, over: Partial<WeeklyWord> = {}): WeeklyWord {
  return {
    id: `w${i}`,
    korean: `단어${i}`,
    meaning: `meaning ${i}`,
    learningState: "learning",
    reviewCount: 4,
    againCount: 0,
    hardCount: 0,
    lastReviewedAt: new Date(NOW.getTime() - DAY),
    createdAt: new Date(NOW.getTime() - 3 * DAY),
    ...over,
  };
}

describe("weekly check", () => {
  const deck = [
    ...Array.from({ length: 20 }, (_, i) => word(i)),
    ...Array.from({ length: 6 }, (_, i) => word(100 + i, { lastReviewedAt: new Date(NOW.getTime() - 20 * DAY), learningState: "learned" })),
    word(200, { reviewCount: 0, lastReviewedAt: null, learningState: "new" }),
  ];

  it("tests studied words only: mostly this week's, plus a few older ones", () => {
    const chosen = pickWeeklyWords(deck, 12, NOW, seeded());
    expect(chosen).toHaveLength(12);
    expect(new Set(chosen.map((w) => w.id)).size).toBe(12);
    expect(chosen.some((w) => w.id === "w200")).toBe(false);
    const older = chosen.filter((w) => Number(w.id.slice(1)) >= 100).length;
    expect(older).toBeGreaterThanOrEqual(2);
    expect(older).toBeLessThanOrEqual(4);
  });

  it("always includes the hardest words of the week", () => {
    const hard = word(7, { againCount: 4, reviewCount: 5 });
    const withHard = deck.map((w) => (w.id === "w7" ? hard : w));
    expect(pickWeeklyWords(withHard, 12, NOW, seeded(5)).some((w) => w.id === "w7")).toBe(true);
  });

  it("builds choice questions with the right answer among 4 options, and typing questions", () => {
    const chosen = pickWeeklyWords(deck, 12, NOW, seeded());
    const questions = buildWeeklyQuestions(chosen, deck, seeded(2));
    expect(questions.some((q) => q.kind === "typing")).toBe(true);
    for (const q of questions.filter((x) => x.kind !== "typing")) {
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(4);
    }
    expect(publicQuestions(questions)[0]).not.toHaveProperty("answer");
  });

  it("falls back to typing when the deck is too small for choices", () => {
    const tiny = [word(1), word(2)];
    expect(buildWeeklyQuestions(tiny, tiny, seeded()).every((q) => q.kind === "typing")).toBe(true);
  });

  it("grades choice and typed answers", () => {
    const questions = [
      { vocabularyId: "a", kind: "ko-choice" as const, prompt: "학교", options: ["school", "home"], answer: "school" },
      { vocabularyId: "b", kind: "typing" as const, prompt: "to eat", options: [], answer: "먹다" },
      { vocabularyId: "c", kind: "typing" as const, prompt: "to go", options: [], answer: "가다" },
    ];
    const rows = gradeWeekly(questions, ["school", " 먹다 ", ""]);
    expect(rows.map((r) => r.correct)).toEqual([true, true, false]);
  });

  it("is due a week after the last check, or a week after the first review", () => {
    const base = { studiedWords: 20, now: NOW };
    expect(weeklyIsDue({ ...base, lastCompletedAt: new Date(NOW.getTime() - 8 * DAY), firstReviewAt: null })).toBe(true);
    expect(weeklyIsDue({ ...base, lastCompletedAt: new Date(NOW.getTime() - 3 * DAY), firstReviewAt: new Date(0) })).toBe(false);
    expect(weeklyIsDue({ ...base, lastCompletedAt: null, firstReviewAt: new Date(NOW.getTime() - 9 * DAY) })).toBe(true);
    expect(weeklyIsDue({ ...base, lastCompletedAt: null, firstReviewAt: new Date(NOW.getTime() - 2 * DAY) })).toBe(false);
    expect(weeklyIsDue({ studiedWords: 3, now: NOW, lastCompletedAt: null, firstReviewAt: new Date(0) })).toBe(false);
  });
});

describe("tutor prompts", () => {
  it("accepts Kazakh as an explanation language and compares grammar with Kazakh", () => {
    expect(parseAiSettings({ lang: "kk" }).lang).toBe("kk");
    expect(parseAiSettings({ lang: "xx" }).lang).toBe("ru");
    expect(teacherVoice("kk")).toContain("Kazakh");
    expect(lessonPrompt({ pattern: "-(으)면", hint: "if", level: 2, lang: "kk", known: [] }).prompt).toContain("closest Kazakh form");
    expect(lessonPrompt({ pattern: "-(으)면", hint: "if", level: 2, lang: "ru", known: [] }).prompt).not.toContain("Kazakh");
  });

  it("validates the mock answers for every tutor task", () => {
    const explain = validateExplain(JSON.parse(mockResponse(explainPrompt("저는 학교에 가요. 밥을 먹어요.", 2, "ru"))));
    expect(explain.sentences).toHaveLength(2);
    expect(explain.sentences[0].parts.map((p) => p.chunk)).toEqual(["저는", "학교에", "가요."]);
    const lesson = validateLesson(JSON.parse(mockResponse(lessonPrompt({ pattern: "-고", hint: "and", level: 1, lang: "ru", known: [] }))));
    expect(lesson.title).toBe("-고");
    expect(lesson.exercises.length).toBeGreaterThan(0);
    const help = validateWordHelp(JSON.parse(mockResponse(wordHelpPrompt({ korean: "시장", meaning: "рынок", level: 2, lang: "ru" }))));
    expect(help.hook).toContain("시장");
  });

  it("rejects broken AI answers", () => {
    expect(() => validateExplain({ sentences: [] })).toThrow();
    expect(() => validateLesson({ title: "x" })).toThrow();
    expect(validateLesson({
      title: "-고",
      explanation: "e",
      examples: [{ ko: "a", tr: "b" }, { ko: "c", tr: "d" }],
      exercises: [{ q: "q", options: ["a", "b"], answer: 5 }, { q: "q", options: ["a", "b"], answer: 1 }],
    }).exercises).toHaveLength(1);
  });

  it("keeps chat history short and clean", () => {
    const messages = cleanChat([{ role: "user", content: " hi " }, { role: "x", content: "" }, { role: "teacher", content: "안녕하세요" }, "junk"]);
    expect(messages).toEqual([{ role: "user", content: "hi" }, { role: "teacher", content: "안녕하세요" }]);
    expect(cleanChat(Array.from({ length: 30 }, () => ({ role: "user", content: "q" })))).toHaveLength(12);
    expect(chatPrompt({ messages, level: 2, lang: "en", weakWords: ["시장"] }).system).toContain("시장");
  });
});

describe("grammar syllabus", () => {
  it("has unique keys", () => {
    expect(new Set(GRAMMAR_SYLLABUS.map((g) => g.key)).size).toBe(GRAMMAR_SYLLABUS.length);
  });
  it("suggests the learner's level first, then gaps below, then the next level", () => {
    expect(nextSyllabusItem(new Set(), 2)?.level).toBe(2);
    const level2 = new Set(GRAMMAR_SYLLABUS.filter((g) => g.level === 2).map((g) => g.key));
    expect(nextSyllabusItem(level2, 2)?.level).toBe(1);
    const upTo2 = new Set(GRAMMAR_SYLLABUS.filter((g) => g.level <= 2).map((g) => g.key));
    expect(nextSyllabusItem(upTo2, 2)?.level).toBe(3);
    expect(nextSyllabusItem(new Set(GRAMMAR_SYLLABUS.map((g) => g.key)), 2)).toBeUndefined();
  });
});

describe("telegram reminders", () => {
  const step = (key: string, done: boolean, count?: number) => ({ key, title: key, detail: "", href: "/", done, optional: false, minutes: 3, count }) as never;
  const streak = { current: 4, todayDone: false, atRisk: true, best: 9 };

  it("lists what is left in the morning", () => {
    const text = reminderText({ streak, steps: [step("review", false, 12), step("reading", false)], complete: false, minutesLeft: 8, weeklyDue: false }, "morning", "https://app.example")!;
    expect(text).toContain("4");
    expect(text).toContain("повторение: 12");
    expect(text).toContain("https://app.example");
  });

  it("stays quiet in the evening once today counts", () => {
    expect(reminderText({ streak: { ...streak, todayDone: true }, steps: [step("reading", false)], complete: false, minutesLeft: 5, weeklyDue: false }, "evening")).toBeNull();
    expect(reminderText({ streak, steps: [step("review", false, 3)], complete: false, minutesLeft: 2, weeklyDue: false }, "evening")).toContain("сгорит");
  });

  it("finds the chat id of the newest private message", () => {
    expect(latestChatId([])).toBeNull();
    expect(
      latestChatId([
        { message: { chat: { id: 1, type: "private" }, date: 10 } },
        { message: { chat: { id: -5, type: "group" }, date: 30 } },
        { message: { chat: { id: 2, type: "private" }, date: 20 } },
      ]),
    ).toBe("2");
  });
});
