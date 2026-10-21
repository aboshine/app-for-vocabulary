import { asArray, asObject, str } from "./json";

export type TranslationLang = "ru" | "en";

export const LANG_NAMES: Record<TranslationLang, string> = { ru: "Russian", en: "English" };

export const LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type Level = (typeof LEVELS)[number];

/** What a text at each TOPIK level should feel like. Kept short: the model knows TOPIK. */
export const LEVEL_GUIDE: Record<Level, { label: string; sentences: string; grammar: string }> = {
  1: {
    label: "TOPIK 1급 (absolute beginner)",
    sentences: "6-8 very short sentences",
    grammar: "present-tense 해요체, 이에요/예요, 있어요/없어요, basic particles (은/는, 이/가, 을/를, 에, 에서), -고 싶어요",
  },
  2: {
    label: "TOPIK 2급 (upper beginner)",
    sentences: "8-12 short sentences",
    grammar:
      "해요체 past/future (-았/었어요, -(으)ㄹ 거예요), -고, -지만, -아서/어서, -(으)니까, -(으)면, -(으)러 가다, -아/어 보다, -(으)ㄹ 수 있다, -기 전에/-(으)ㄴ 후에",
  },
  3: {
    label: "TOPIK 3급 (lower intermediate)",
    sentences: "10-14 sentences",
    grammar: "-는데, -(으)ㄹ 때, -게 되다, -기로 하다, -는 것 같다, simple indirect speech (-다고 하다), adnominal -는/-(으)ㄴ/-(으)ㄹ",
  },
  4: {
    label: "TOPIK 4급 (intermediate)",
    sentences: "12-16 sentences",
    grammar: "-더라고요, -(으)ㄹ 뿐만 아니라, -는 바람에, -다 보니, passive/causative verbs, written style mixed with 해요체",
  },
  5: {
    label: "TOPIK 5급 (upper intermediate)",
    sentences: "a paragraph of 12-18 sentences",
    grammar: "newspaper-like written style (-다), -(으)ㅁ에 따라, -는 반면에, Sino-Korean abstract vocabulary",
  },
  6: {
    label: "TOPIK 6급 (advanced)",
    sentences: "a paragraph of 14-20 sentences",
    grammar: "formal written style, idioms and 사자성어 where natural, complex nominalisation",
  },
};

export function parseLevel(value: unknown, fallback: Level = 2): Level {
  const n = Number(value);
  return (LEVELS as readonly number[]).includes(n) ? (n as Level) : fallback;
}

/* ------------------------------------------------------------------ reading */

export interface ReadingToken {
  /** surface form exactly as it appears (one space-separated chunk, punctuation included) */
  t: string;
  /** dictionary form of the content word, e.g. 먹었어요 → 먹다, 학교에서 → 학교 */
  lemma: string;
  /** short translation of the lemma in the learner's language */
  gloss: string;
}

export interface ReadingSentence {
  ko: string;
  tr: string;
  tokens: ReadingToken[];
}

export interface ReadingQuestion {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface GrammarNote {
  pattern: string;
  explain: string;
  example: string;
}

export interface ReadingPayload {
  title: string;
  titleTr: string;
  sentences: ReadingSentence[];
  questions: ReadingQuestion[];
  grammar: GrammarNote[];
}

export interface ReadingPromptInput {
  level: Level;
  lang: TranslationLang;
  theme: string;
  targets: Array<{ korean: string; meaning: string }>;
  known: string[];
}

export function readingPrompt(input: ReadingPromptInput) {
  const guide = LEVEL_GUIDE[input.level];
  const lang = LANG_NAMES[input.lang];
  const system = [
    "TASK: reading",
    "You write graded reading texts for a learner of Korean. You are a careful Korean teacher: every sentence must be natural, grammatical Korean that a native speaker would write.",
    `Learner level: ${guide.label}. Translations and explanations are in ${lang}.`,
    "Comprehensible input rule: about 95% of the words must be words the learner already knows or very common words of that level. Avoid rare words except the target words.",
  ].join("\n");

  const prompt = `Write today's reading text.

Topic: ${input.theme || "everyday life of a university student in Korea"}
Length: ${guide.sentences}.
Grammar to use (only what fits naturally): ${guide.grammar}.
Style: 해요체 (polite), a small story or diary entry with a clear situation, not a list of facts.

TARGET WORDS — every one must appear at least once (any inflected form is fine), ideally twice:
${input.targets.map((t) => `- ${t.korean} (${t.meaning})`).join("\n") || "- (none: just use common words of this level)"}

Words the learner already knows (prefer these for everything else):
${input.known.slice(0, 400).join(", ") || "(unknown, use only very common words)"}

Return JSON exactly in this shape:
{
  "title": "Korean title",
  "titleTr": "title in ${lang}",
  "sentences": [
    {
      "ko": "one Korean sentence",
      "tr": "natural ${lang} translation",
      "tokens": [ { "t": "surface chunk", "lemma": "dictionary form", "gloss": "${lang} meaning of the lemma, 1-3 words" } ]
    }
  ],
  "questions": [
    { "q": "comprehension question in Korean", "options": ["Korean option", "...", "...", "..."], "answer": 0, "explain": "why, in ${lang}" }
  ],
  "grammar": [ { "pattern": "e.g. -아서/어서", "explain": "short ${lang} explanation of how it is used in this text", "example": "the sentence from the text" } ]
}

Rules for tokens: split "ko" on spaces; one token per chunk, in order, so that joining the "t" values with single spaces gives back "ko" exactly. "lemma" is the dictionary form of the main content word in the chunk (strip particles and endings: 학교에서 → 학교, 먹었어요 → 먹다, 공부하고 → 공부하다). For target words, the lemma must be written exactly as in the target list.
Give 3 or 4 questions with 4 options each and 1-2 grammar notes.`;

  return { system, prompt };
}

export function validateReading(value: unknown): ReadingPayload {
  const data = asObject(value, "answer");
  const sentences = asArray(data.sentences, "sentences")
    .map((raw) => {
      const s = asObject(raw, "sentence");
      const ko = str(s.ko, 600);
      if (!ko) return null;
      const rawTokens = Array.isArray(s.tokens) ? s.tokens : [];
      const tokens = rawTokens
        .map((rt) => {
          const tok = rt && typeof rt === "object" ? (rt as Record<string, unknown>) : {};
          return { t: str(tok.t, 80), lemma: str(tok.lemma, 80), gloss: str(tok.gloss, 120) };
        })
        .filter((tok) => tok.t);
      // If the model's tokens don't line up with the sentence, fall back to plain chunks.
      const aligned = tokens.length && tokens.map((tok) => tok.t).join(" ").replace(/\s+/g, " ") === ko.replace(/\s+/g, " ");
      return {
        ko,
        tr: str(s.tr, 600),
        tokens: aligned ? tokens : alignTokens(ko, tokens),
      };
    })
    .filter((s): s is ReadingSentence => s !== null);
  if (sentences.length < 3) throw new Error("text is too short");

  const questions = (Array.isArray(data.questions) ? data.questions : [])
    .map((raw) => {
      const q = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const options = (Array.isArray(q.options) ? q.options : []).map((o) => str(o, 200)).filter(Boolean);
      const answer = Number(q.answer);
      if (!str(q.q) || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;
      return { q: str(q.q), options, answer, explain: str(q.explain) };
    })
    .filter((q): q is ReadingQuestion => q !== null)
    .slice(0, 5);

  const grammar = (Array.isArray(data.grammar) ? data.grammar : [])
    .map((raw) => {
      const g = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      return { pattern: str(g.pattern, 80), explain: str(g.explain), example: str(g.example) };
    })
    .filter((g) => g.pattern)
    .slice(0, 3);

  return {
    title: str(data.title, 120) || "오늘의 글",
    titleTr: str(data.titleTr, 120),
    sentences,
    questions,
    grammar,
  };
}

/** Rebuild one token per space-separated chunk, reusing the model's glosses where the chunk matches. */
export function alignTokens(ko: string, tokens: ReadingToken[]): ReadingToken[] {
  const bySurface = new Map(tokens.map((tok) => [tok.t, tok]));
  return ko
    .split(/\s+/)
    .filter(Boolean)
    .map((chunk) => bySurface.get(chunk) ?? { t: chunk, lemma: "", gloss: "" });
}

/* ------------------------------------------------------------------ fill a card */

export interface CardFill {
  meaning: string;
  partOfSpeech: string;
  hanja: string;
  exampleSentence: string;
  exampleTranslation: string;
  note: string;
}

export function fillPrompt(korean: string, level: Level, lang: TranslationLang) {
  const langName = LANG_NAMES[lang];
  return {
    system: [
      "TASK: fill",
      `You are a Korean dictionary for a ${LEVEL_GUIDE[level].label} learner whose language is ${langName}.`,
    ].join("\n"),
    prompt: `Korean word or expression: ${korean}

Return JSON:
{
  "meaning": "main ${langName} meaning(s), short, comma-separated",
  "partOfSpeech": "noun / verb / adjective / adverb / expression ... (in ${langName})",
  "hanja": "Chinese characters if Sino-Korean, else empty string",
  "exampleSentence": "one natural, simple 해요체 example sentence at the learner's level that uses the word",
  "exampleTranslation": "${langName} translation of the example",
  "note": "one short useful ${langName} note: a common collocation, an easily confused word, or irregular conjugation. Empty if nothing useful."
}`,
  };
}

export function validateFill(value: unknown): CardFill {
  const data = asObject(value, "answer");
  const meaning = str(data.meaning, 200);
  if (!meaning) throw new Error("no meaning");
  return {
    meaning,
    partOfSpeech: str(data.partOfSpeech, 60),
    hanja: str(data.hanja, 40),
    exampleSentence: str(data.exampleSentence, 500),
    exampleTranslation: str(data.exampleTranslation, 500),
    note: str(data.note, 400),
  };
}

export function fillNotes(fill: Pick<CardFill, "partOfSpeech" | "hanja" | "note">): string {
  return [fill.partOfSpeech, fill.hanja, fill.note].filter(Boolean).join(" · ");
}

/* ------------------------------------------------------------------ word packs */

export interface PackWord {
  korean: string;
  meaning: string;
  exampleSentence: string;
  exampleTranslation: string;
  notes: string;
}

export function packPrompt(input: { topic: string; level: Level; lang: TranslationLang; count: number; exclude: string[] }) {
  const langName = LANG_NAMES[input.lang];
  return {
    system: [
      "TASK: pack",
      `You build vocabulary lists for a ${LEVEL_GUIDE[input.level].label} learner of Korean whose language is ${langName}.`,
      "Choose high-frequency, genuinely useful words for the topic, the kind that appear in TOPIK and in daily life in Korea. No rare or overly specific words.",
    ].join("\n"),
    prompt: `Topic: ${input.topic}
Give ${input.count} words or short fixed expressions for this topic at this level. Mix nouns, verbs and adjectives so they can form sentences together.
Do NOT include any of these (the learner already has them): ${input.exclude.slice(0, 600).join(", ") || "(none)"}

Return JSON:
{ "words": [ { "korean": "dictionary form", "meaning": "${langName}, short", "exampleSentence": "simple natural 해요체 sentence", "exampleTranslation": "${langName}", "notes": "part of speech; hanja if any" } ] }`,
  };
}

export function validatePack(value: unknown): PackWord[] {
  const data = asObject(value, "answer");
  const seen = new Set<string>();
  const words: PackWord[] = [];
  for (const raw of asArray(data.words, "words")) {
    const w = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const korean = str(w.korean, 200);
    const meaning = str(w.meaning, 200);
    if (!korean || !meaning || seen.has(korean)) continue;
    seen.add(korean);
    words.push({
      korean,
      meaning,
      exampleSentence: str(w.exampleSentence, 500),
      exampleTranslation: str(w.exampleTranslation, 500),
      notes: str(w.notes, 300),
    });
  }
  if (!words.length) throw new Error("no words");
  return words;
}
