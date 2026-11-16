import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { mockResponse } from "../lib/ai/mock";
import { translatePrompt, validateTranslated, validateWriting, writingPrompt } from "../lib/ai/tutor-prompts";
import { isAuthorized, isPublicPath, passwordConfigured, safeEqual, sessionToken } from "../lib/auth";
import { buildDailySteps, extraOfTheDay, type PlanInput } from "../lib/plan";
import { DIRECTIONS } from "../lib/srs";
import { buildGrammarQuestions, gradeWeekly } from "../lib/weekly";

describe("password gate", () => {
  it("is off without APP_PASSWORD and lets everyone in", async () => {
    expect(passwordConfigured({})).toBe(false);
    expect(await isAuthorized(undefined, {})).toBe(true);
  });

  it("accepts only the cookie made from the right password", async () => {
    const env = { APP_PASSWORD: "han-geul 123" };
    expect(passwordConfigured(env)).toBe(true);
    expect(await isAuthorized(undefined, env)).toBe(false);
    expect(await isAuthorized(await sessionToken("wrong"), env)).toBe(false);
    expect(await isAuthorized(await sessionToken("han-geul 123"), env)).toBe(true);
  });

  it("does not put the password itself in the cookie", async () => {
    const token = await sessionToken("secret-pass");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(token).not.toContain("secret-pass");
  });

  it("compares strings safely", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("keeps login, cron and icon files reachable, and everything else locked", () => {
    for (const path of ["/login", "/api/login", "/api/cron/remind", "/manifest.webmanifest", "/icons/icon-192.png", "/_next/static/x.js"]) {
      expect(isPublicPath(path)).toBe(true);
    }
    for (const path of ["/", "/api/plan", "/api/vocabulary", "/settings", "/api/telegram", "/login/x", "/api/loginx"]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });
});

describe("extra practice of the day", () => {
  const base: PlanInput = {
    dueNow: 0, reviewedToday: 0, reviewTarget: 20, newWaiting: 5, newIntroducedToday: 0, newPerDay: 5,
    readingDone: false, readingExists: false, aiConfigured: true, grammarThisWeek: 0, grammarPerWeek: 2, weeklyDue: false, weakCount: 0,
  };

  it("rotates grammar, writing and listening through the week", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => extraOfTheDay(d, true))).toEqual([
      "grammar", "writing", "listening", "grammar", "writing", "listening", "grammar",
    ]);
  });

  it("swaps grammar for writing once the week's lessons are done", () => {
    expect(extraOfTheDay(0, false)).toBe("writing");
  });

  it("adds exactly one optional extra step to the plan", () => {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const extras = buildDailySteps({ ...base, weekday }).filter((s) => ["grammar", "writing", "listening"].includes(s.key));
      expect(extras).toHaveLength(1);
      expect(extras[0].optional).toBe(true);
    }
  });
});

describe("grammar questions in the weekly check", () => {
  const lessons = Array.from({ length: 5 }, (_, i) => ({
    grammarId: `g${i}`,
    exercises: [{ q: `q${i}`, options: ["a", "b", "c", "d"], answer: 2 }],
  }));

  it("takes at most three, one per lesson, keeping the right answer", () => {
    const questions = buildGrammarQuestions(lessons, () => 0.42);
    expect(questions).toHaveLength(3);
    expect(new Set(questions.map((q) => q.grammarId)).size).toBe(3);
    for (const q of questions) {
      expect(q.kind).toBe("grammar");
      expect(q.answer).toBe("c");
      expect(q.options).toContain("c");
    }
  });

  it("skips lessons without usable exercises", () => {
    expect(buildGrammarQuestions([{ grammarId: "g", exercises: [] }, { grammarId: "", exercises: lessons[0].exercises }])).toHaveLength(0);
    expect(buildGrammarQuestions([{ grammarId: "g", exercises: [{ q: "q", options: ["a"], answer: 3 }] }])).toHaveLength(0);
  });

  it("grades them and keeps the grammar id for the follow-up review", () => {
    const [q] = buildGrammarQuestions(lessons.slice(0, 1), () => 0.1);
    expect(gradeWeekly([q], ["c"])[0]).toMatchObject({ correct: true, grammarId: "g0" });
    expect(gradeWeekly([q], ["a"])[0].correct).toBe(false);
  });
});

describe("writing and translation prompts", () => {
  it("records writing and listening as their own review types", () => {
    expect(DIRECTIONS).toContain("writing");
    expect(DIRECTIONS).toContain("listening");
  });

  it("validates writing feedback and never credits an unused word", () => {
    const prompt = writingPrompt({ text: "저는 시장에 가요. 밥을 먹어요.", words: [{ korean: "시장", meaning: "рынок" }, { korean: "학교", meaning: "школа" }], grammar: "", level: 2, lang: "ru" });
    const feedback = validateWriting(JSON.parse(mockResponse(prompt)));
    expect(feedback.sentences).toHaveLength(2);
    expect(feedback.sentences[0].ok).toBe(true);
    expect(feedback.words.find((w) => w.korean === "시장")).toMatchObject({ used: true, correct: true });
    expect(feedback.words.find((w) => w.korean === "학교")).toMatchObject({ used: false, correct: false });
    expect(validateWriting({ words: [{ korean: "x", used: false, correct: true }], overall: "ok" }).words[0].correct).toBe(false);
    expect(() => validateWriting({})).toThrow();
  });

  it("matches translated cards by number and drops empty ones", () => {
    const prompt = translatePrompt({ cards: [{ korean: "가다", meaning: "идти", example: "학교에 가요." }, { korean: "책", meaning: "книга", example: "" }], lang: "kk" });
    const cards = validateTranslated(JSON.parse(mockResponse(prompt)));
    expect(cards.map((c) => c.i)).toEqual([0, 1]);
    expect(cards[1].exampleTranslation).toBe("");
    expect(validateTranslated({ cards: [{ i: 0, meaning: "" }, { i: "x", meaning: "a" }, { i: 2, meaning: "бару" }] })).toHaveLength(1);
  });
});
