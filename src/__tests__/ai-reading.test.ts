import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
import { CURRICULUM } from "@/data/curriculum";
import { activeProvider, generateJson, modelsFor } from "@/lib/ai/client";
import { extractJson } from "@/lib/ai/json";
import { packPrompt, readingPrompt, validateFill, validatePack, validateReading } from "@/lib/ai/prompts";
import { nextEntries, normalizeKorean, themeProgress } from "@/lib/curriculum";
import { dayKey, linkTokens, selectTargets, type TargetCandidate } from "@/lib/reading";
import { parseSettings } from "@/lib/settings";

const now = new Date("2026-10-21T10:00:00+09:00");

function word(id: string, overrides: Partial<TargetCandidate> = {}): TargetCandidate {
  return {
    id,
    korean: id,
    meaning: id,
    categoryId: null,
    learningState: "new",
    nextReviewAt: now,
    reviewCount: 0,
    againCount: 0,
    hardCount: 0,
    createdAt: new Date("2026-10-01"),
    ...overrides,
  };
}

describe("extractJson", () => {
  it("parses plain, fenced and wrapped JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('Here you go: {"a":3} hope it helps')).toEqual({ a: 3 });
    expect(() => extractJson("no json")).toThrow();
  });
});

describe("validateReading", () => {
  const sentence = (ko: string, tokens?: Array<{ t: string; lemma: string; gloss: string }>) => ({ ko, tr: "tr", tokens });

  it("keeps aligned tokens and rebuilds misaligned ones from the sentence", () => {
    const payload = validateReading({
      title: "제목",
      sentences: [
        sentence("저는 학교에 가요.", [
          { t: "저는", lemma: "저", gloss: "я" },
          { t: "학교에", lemma: "학교", gloss: "школа" },
          { t: "가요.", lemma: "가다", gloss: "идти" },
        ]),
        sentence("친구를 만났어요.", [{ t: "친구를", lemma: "친구", gloss: "друг" }]),
        sentence("재미있었어요."),
      ],
      questions: [
        { q: "어디에 가요?", options: ["학교", "집"], answer: 0, explain: "" },
        { q: "bad", options: ["a"], answer: 3 },
      ],
    });
    expect(payload.sentences[0].tokens.map((t) => t.lemma)).toEqual(["저", "학교", "가다"]);
    expect(payload.sentences[1].tokens).toEqual([
      { t: "친구를", lemma: "친구", gloss: "друг" },
      { t: "만났어요.", lemma: "", gloss: "" },
    ]);
    expect(payload.sentences[2].tokens).toHaveLength(1);
    expect(payload.questions).toHaveLength(1);
  });

  it("rejects texts that are too short", () => {
    expect(() => validateReading({ sentences: [sentence("하나.")] })).toThrow();
  });
});

describe("other validators", () => {
  it("validateFill requires a meaning", () => {
    expect(() => validateFill({ meaning: "" })).toThrow();
    expect(validateFill({ meaning: "школа", hanja: "學校" }).hanja).toBe("學校");
  });

  it("validatePack drops duplicates and empty rows", () => {
    const words = validatePack({
      words: [
        { korean: "학교", meaning: "школа" },
        { korean: "학교", meaning: "dup" },
        { korean: "", meaning: "x" },
      ],
    });
    expect(words).toHaveLength(1);
  });
});

describe("prompts", () => {
  it("lists every target word and the level", () => {
    const { prompt, system } = readingPrompt({
      level: 2,
      lang: "ru",
      theme: "food",
      targets: [{ korean: "맵다", meaning: "острый" }],
      known: ["학교"],
    });
    expect(system).toContain("TOPIK 2급");
    expect(prompt).toContain("- 맵다 (острый)");
    expect(prompt).toContain("학교");
  });

  it("pack prompt excludes known words", () => {
    expect(packPrompt({ topic: "x", level: 2, lang: "ru", count: 5, exclude: ["물"] }).prompt).toContain("물");
  });
});

describe("selectTargets", () => {
  it("takes theme words first (up to 60%), then due words, then other new words", () => {
    const words = [
      word("t1", { categoryId: "theme", learningState: "learning" }),
      word("t2", { categoryId: "theme" }),
      word("t3", { categoryId: "theme" }),
      word("t4", { categoryId: "theme" }),
      word("due-hard", { learningState: "learning", reviewCount: 4, againCount: 3 }),
      word("due-easy", { learningState: "learned", reviewCount: 4 }),
      word("later", { learningState: "learned", nextReviewAt: new Date("2026-11-30") }),
      word("new-other"),
    ];
    const ids = selectTargets(words, { count: 5, themeCategoryId: "theme", now }).map((w) => w.id);
    expect(ids).toEqual(["t1", "t2", "t3", "due-hard", "due-easy"]);
  });

  it("falls back to new words when nothing is due", () => {
    const ids = selectTargets([word("a"), word("b")], { count: 5, now }).map((w) => w.id);
    expect(ids).toEqual(["a", "b"]);
  });
});

describe("linkTokens", () => {
  it("matches lemmas, inflected verb stems and multi-word expressions", () => {
    const payload = validateReading({
      sentences: [
        { ko: "김치가 매워요.", tr: "", tokens: [{ t: "김치가", lemma: "김치", gloss: "" }, { t: "매워요.", lemma: "", gloss: "" }] },
        { ko: "불을 켰어요.", tr: "", tokens: [{ t: "불을", lemma: "불", gloss: "" }, { t: "켰어요.", lemma: "켜다", gloss: "" }] },
        { ko: "공부하고 싶어요.", tr: "", tokens: [{ t: "공부하고", lemma: "", gloss: "" }, { t: "싶어요.", lemma: "싶다", gloss: "" }] },
      ],
    });
    const deck = [
      { id: "kimchi", korean: "김치" },
      { id: "spicy", korean: "맵다" },
      { id: "light", korean: "불을 켜다" },
      { id: "eat", korean: "공부하다" },
    ];
    const links = linkTokens(payload, deck, ["spicy", "light", "eat"]);
    expect(links[0]).toEqual(["kimchi", null]); // 매워요 is irregular and 맵다 is a 1-syllable stem: needs the lemma from the AI
    expect(links[1]).toEqual([null, "light"]);
    expect(links[2]).toEqual(["eat", null]);
  });
});

describe("curriculum", () => {
  it("has no duplicate words and every entry has an example", () => {
    const seen = new Map<string, string>();
    for (const theme of CURRICULUM) {
      for (const [korean, meaning, example, exampleTr] of theme.words) {
        const key = normalizeKorean(korean);
        expect(seen.has(key), `${korean} in ${theme.key} and ${seen.get(key)}`).toBe(false);
        seen.set(key, theme.key);
        expect(meaning && example && exampleTr, korean).toBeTruthy();
      }
    }
    expect(seen.size).toBeGreaterThan(300);
  });

  it("computes progress and the next pack", () => {
    const theme = CURRICULUM[0];
    const deck = new Map([[normalizeKorean(theme.words[0][0]), "learned"]]);
    const progress = themeProgress(theme, deck);
    expect(progress.inDeck).toBe(1);
    expect(progress.learned).toBe(1);
    expect(nextEntries(theme, new Set(deck.keys()), 3).map((e) => e[0])).toEqual(
      theme.words.slice(1, 4).map((e) => e[0]),
    );
  });
});

describe("settings", () => {
  it("falls back to defaults on bad values", () => {
    expect(parseSettings([{ key: "level", value: "9" }, { key: "packSize", value: "abc" }, { key: "lang", value: "en" }])).toMatchObject({
      level: 2,
      packSize: 8,
      lang: "en",
    });
  });
});

describe("dayKey", () => {
  it("uses the app time zone", () => {
    expect(dayKey(new Date("2026-10-20T16:30:00Z"), "Asia/Seoul")).toBe("2026-10-21");
    expect(dayKey(new Date("2026-10-20T16:30:00Z"), "UTC")).toBe("2026-10-20");
  });
});

describe("AI client", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("picks the provider from the environment", () => {
    expect(activeProvider({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(activeProvider({ GEMINI_API_KEY: "x" } as unknown as NodeJS.ProcessEnv)).toBe("gemini");
    expect(activeProvider({ ANTHROPIC_API_KEY: "x" } as unknown as NodeJS.ProcessEnv)).toBe("anthropic");
    expect(modelsFor("gemini", "fast", {} as unknown as NodeJS.ProcessEnv)[0]).toContain("flash-lite");
  });

  it("returns validated mock data", async () => {
    process.env.AI_PROVIDER = "mock";
    const { system, prompt } = readingPrompt({
      level: 2,
      lang: "ru",
      theme: "",
      targets: [{ korean: "시장", meaning: "рынок" }],
      known: [],
    });
    const { data } = await generateJson({ system, prompt }, validateReading);
    expect(data.sentences.length).toBeGreaterThan(3);
    expect(data.sentences.some((s) => s.ko.includes("시장"))).toBe(true);
  });
});
