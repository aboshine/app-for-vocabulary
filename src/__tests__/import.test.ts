import { describe, expect, it } from "vitest";
import { parseImportText, parseDelimited, detectDelimiter } from "../lib/import/parse";
import { planImport, srsInitFields, summarizePlan, validateImportRows } from "../lib/import/plan";

describe("parseImportText", () => {
  it("parses CSV with quoted commas", () => {
    const result = parseImportText(
      'korean,meaning,notes\n안녕하세요,"hello, hi","formal greeting"',
    );
    expect("rows" in result).toBe(true);
    if ("rows" in result) {
      expect(result.rows[0]).toMatchObject({
        korean: "안녕하세요",
        meaning: "hello, hi",
        notes: "formal greeting",
        rowNumber: 2,
      });
    }
  });

  it("parses tab-separated paste from sheets", () => {
    expect(detectDelimiter("korean\tmeaning\n물\twater")).toBe("\t");
    const result = parseImportText("korean\tmeaning\tcategory\n물\twater\tFood");
    expect("rows" in result).toBe(true);
    if ("rows" in result) {
      expect(result.rows[0]).toMatchObject({ korean: "물", meaning: "water", category: "Food" });
    }
  });

  it("rejects missing korean/meaning headers", () => {
    const result = parseImportText("word,def\n물,water");
    expect(result).toEqual({ error: "Header must include korean and meaning columns." });
  });

  it("maps spaced header aliases", () => {
    const result = parseImportText(
      "Korean,Meaning,Example Sentence,Example Translation\n먹다,to eat,밥을 먹어요,I eat rice",
    );
    if ("rows" in result) {
      expect(result.rows[0].exampleSentence).toBe("밥을 먹어요");
      expect(result.rows[0].exampleTranslation).toBe("I eat rice");
    }
  });

  it("parses quoted delimiters without splitting fields", () => {
    const rows = parseDelimited('a,"b,c",d', ",");
    expect(rows[0]).toEqual(["a", "b,c", "d"]);
  });
});

describe("validateImportRows", () => {
  it("flags missing required fields", () => {
    const rows = validateImportRows(
      [
        {
          rowNumber: 2,
          korean: "",
          meaning: "hello",
          exampleSentence: "",
          exampleTranslation: "",
          category: "",
          tags: "",
          notes: "",
        },
        {
          rowNumber: 3,
          korean: "물",
          meaning: "",
          exampleSentence: "",
          exampleTranslation: "",
          category: "",
          tags: "",
          notes: "",
        },
      ],
      new Map(),
    );
    expect(rows[0].errors).toContain("korean is required");
    expect(rows[1].errors).toContain("meaning is required");
  });

  it("detects file and database duplicates", () => {
    const base = {
      exampleSentence: "",
      exampleTranslation: "",
      category: "",
      tags: "",
      notes: "",
    };
    const rows = validateImportRows(
      [
        { ...base, rowNumber: 2, korean: "물", meaning: "water" },
        { ...base, rowNumber: 3, korean: "물", meaning: "H2O" },
        { ...base, rowNumber: 4, korean: "친구", meaning: "friend" },
      ],
      new Map([["친구", "id-1"]]),
    );
    expect(rows[0].fileDuplicate).toBe(false);
    expect(rows[1].fileDuplicate).toBe(true);
    expect(rows[2].dbDuplicate).toBe(true);
    expect(rows[2].existingId).toBe("id-1");
  });
});

describe("planImport", () => {
  const ready = {
    rowNumber: 2,
    korean: "학교",
    meaning: "school",
    exampleSentence: "",
    exampleTranslation: "",
    category: "Everyday",
    tags: "",
    notes: "",
    errors: [] as string[],
    fileDuplicate: false,
    dbDuplicate: false,
    existingId: null as string | null,
  };

  it("inserts new rows and skips or updates database duplicates", () => {
    const duplicate = { ...ready, rowNumber: 3, korean: "물", dbDuplicate: true, existingId: "abc" };
    const skip = planImport([ready, duplicate], "skip");
    expect(summarizePlan(skip)).toEqual({ imported: 1, updated: 0, skipped: 1, failed: 0 });
    const update = planImport([ready, duplicate], "update");
    expect(summarizePlan(update)).toEqual({ imported: 1, updated: 1, skipped: 0, failed: 0 });
  });

  it("counts validation failures and in-file duplicates separately", () => {
    const failed = { ...ready, korean: "", errors: ["korean is required"] };
    const fileDup = { ...ready, rowNumber: 4, fileDuplicate: true };
    const plan = planImport([ready, failed, fileDup], "skip");
    expect(summarizePlan(plan)).toEqual({ imported: 1, updated: 0, skipped: 1, failed: 1 });
    expect(plan.inserts[0].korean).toBe("학교");
  });
});

describe("bulk import SRS init", () => {
  it("sets new-card review state for inserted words", () => {
    const now = new Date("2026-09-19T00:00:00.000Z");
    expect(srsInitFields(now)).toEqual({
      learningState: "new",
      intervalMinutes: 0,
      nextReviewAt: now,
      reviewCount: 0,
      againCount: 0,
      hardCount: 0,
      goodCount: 0,
      easyCount: 0,
    });
  });

  it("applies insert and update batches without touching skipped SRS", () => {
    const now = new Date("2026-09-19T00:00:00.000Z");
    const store = new Map<string, { meaning: string; learningState: string; intervalMinutes: number }>([
      ["물", { meaning: "old", learningState: "learned", intervalMinutes: 4000 }],
    ]);
    const base = {
      exampleSentence: "",
      exampleTranslation: "",
      category: "",
      tags: "",
      notes: "",
      errors: [] as string[],
      fileDuplicate: false,
      dbDuplicate: false,
      existingId: null as string | null,
    };
    const plan = planImport(
      [
        { ...base, rowNumber: 2, korean: "학교", meaning: "school" },
        { ...base, rowNumber: 3, korean: "물", meaning: "water", dbDuplicate: true, existingId: "id-water" },
      ],
      "update",
    );
    for (const row of plan.inserts) {
      store.set(row.korean, { meaning: row.meaning, ...srsInitFields(now) });
    }
    for (const row of plan.updates) {
      const current = store.get(row.korean);
      store.set(row.korean, { ...current!, meaning: row.meaning });
    }
    expect(store.get("학교")).toMatchObject({ meaning: "school", learningState: "new", intervalMinutes: 0 });
    expect(store.get("물")).toMatchObject({ meaning: "water", learningState: "learned", intervalMinutes: 4000 });
  });
});
