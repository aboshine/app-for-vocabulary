import { asArray, asObject, str } from "./json";
import { LANG_NAMES, LEVEL_GUIDE, type Level, type TranslationLang } from "./prompts";

/**
 * Prompts for the "personal teacher": sentence breakdowns, grammar lessons,
 * help with words that will not stick, a weekly note and free chat.
 */

/** How the teacher talks, depending on the learner's language. */
export function teacherVoice(lang: TranslationLang): string {
  const base =
    "Explain like a patient tutor talking to one student: short sentences, plain everyday words, no linguistics jargon. One idea per sentence.";
  if (lang === "kk") {
    return [
      "The learner is a native Kazakh speaker who also reads Russian. Write all explanations and translations in simple, everyday Kazakh (Cyrillic).",
      base,
      "Korean and Kazakh are both agglutinative SOV languages with case endings and converbs. Whenever a Korean form has a real Kazakh counterpart, put them side by side (for example -에서 ≈ -да/-де or -дан/-ден, -(으)면 ≈ -са/-се, -고 싶다 ≈ -ғы/-гі келеді, -아서/어서 ≈ -ып/-іп, -지만 ≈ бірақ). Say honestly when there is no close parallel instead of forcing one.",
      "If a Kazakh grammar term may be unfamiliar, add the Russian word in brackets once.",
    ].join(" ");
  }
  if (lang === "ru") {
    return `Write all explanations and translations in simple Russian. ${base} Compare with Russian only when it really helps.`;
  }
  return `Write all explanations and translations in simple English. ${base}`;
}

function compareHint(lang: TranslationLang): string {
  return lang === "kk"
    ? "the closest Kazakh form with a tiny Kazakh example, or an empty string if there is no real parallel"
    : `a short comparison with ${LANG_NAMES[lang]} if it helps, else an empty string`;
}

/* ------------------------------------------------------------------ sentence breakdown */

export interface ExplainPart {
  chunk: string;
  base: string;
  explain: string;
}

export interface ExplainGrammar {
  pattern: string;
  explain: string;
  compare: string;
}

export interface ExplainSentence {
  ko: string;
  tr: string;
  parts: ExplainPart[];
  grammar: ExplainGrammar[];
}

export interface ExplainPayload {
  sentences: ExplainSentence[];
  tip: string;
}

export const EXPLAIN_MAX_CHARS = 600;

export function explainPrompt(text: string, level: Level, lang: TranslationLang) {
  const langName = LANG_NAMES[lang];
  return {
    system: ["TASK: explain", "You are a Korean teacher who breaks sentences down for a learner.", `Learner level: ${LEVEL_GUIDE[level].label}.`, teacherVoice(lang)].join(
      "\n",
    ),
    prompt: `Break down this Korean text sentence by sentence:

"""
${text.slice(0, EXPLAIN_MAX_CHARS)}
"""

Return JSON:
{
  "sentences": [
    {
      "ko": "the sentence exactly as written",
      "tr": "natural ${langName} translation",
      "parts": [ { "chunk": "one space-separated piece, e.g. 학교에서", "base": "dictionary form, e.g. 학교", "explain": "what the word means + what each ending/particle does here, in ${langName}, one short line" } ],
      "grammar": [ { "pattern": "e.g. -(으)면", "explain": "what it means and how it is attached, 1-2 short sentences", "compare": "${compareHint(lang)}" } ]
    }
  ],
  "tip": "the single most useful thing to remember from this text, one sentence"
}

Rules: every space-separated piece of a sentence gets one "parts" entry, in order. In "grammar" list only patterns that matter for understanding (at most 3 per sentence), skip the trivial ones the learner at this level surely knows. If the text has mistakes, still explain it and mention the fix in "tip".`,
  };
}

export function validateExplain(value: unknown): ExplainPayload {
  const data = asObject(value, "answer");
  const sentences = asArray(data.sentences, "sentences")
    .map((raw) => {
      const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const ko = str(s.ko, 600);
      if (!ko) return null;
      const parts = (Array.isArray(s.parts) ? s.parts : [])
        .map((rp) => {
          const p = rp && typeof rp === "object" ? (rp as Record<string, unknown>) : {};
          return { chunk: str(p.chunk, 80), base: str(p.base, 80), explain: str(p.explain, 400) };
        })
        .filter((p) => p.chunk);
      const grammar = (Array.isArray(s.grammar) ? s.grammar : [])
        .map((rg) => {
          const g = rg && typeof rg === "object" ? (rg as Record<string, unknown>) : {};
          return { pattern: str(g.pattern, 80), explain: str(g.explain, 600), compare: str(g.compare, 400) };
        })
        .filter((g) => g.pattern)
        .slice(0, 4);
      return { ko, tr: str(s.tr, 600), parts, grammar };
    })
    .filter((s): s is ExplainSentence => s !== null)
    .slice(0, 12);
  if (!sentences.length) throw new Error("no sentences");
  return { sentences, tip: str(data.tip, 500) };
}

/* ------------------------------------------------------------------ grammar lesson */

export interface LessonExample {
  ko: string;
  tr: string;
}

export interface LessonExercise {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface LessonPayload {
  title: string;
  meaning: string;
  structure: string;
  explanation: string;
  compare: string;
  examples: LessonExample[];
  mistake: string;
  exercises: LessonExercise[];
}

export function lessonPrompt(input: { pattern: string; hint: string; level: Level; lang: TranslationLang; known: string[] }) {
  const langName = LANG_NAMES[input.lang];
  return {
    system: [
      "TASK: lesson",
      "You are a Korean teacher writing one short grammar lesson for one student.",
      `Learner level: ${LEVEL_GUIDE[input.level].label}.`,
      teacherVoice(input.lang),
    ].join("\n"),
    prompt: `Grammar point: ${input.pattern}
What it is: ${input.hint}

Words the learner knows (use these and other very common words in examples): ${input.known.slice(0, 150).join(", ") || "(only very common beginner words)"}

Return JSON:
{
  "title": "the pattern, e.g. -(으)면",
  "meaning": "what it means, in ${langName}, max 8 words",
  "structure": "how to attach it, as 2-4 short lines: after a vowel / after a consonant / irregular cases, each with a tiny example (가다 → 가면)",
  "explanation": "when and why Koreans use it, 3-5 short sentences in ${langName}",
  "compare": "${compareHint(input.lang)}",
  "examples": [ { "ko": "natural 해요체 sentence using the pattern", "tr": "${langName} translation" } ],
  "mistake": "one mistake learners often make with this pattern and how to avoid it, 1-2 sentences",
  "exercises": [ { "q": "a Korean sentence with ___ where the pattern goes, or a short question about meaning", "options": ["4 options"], "answer": 0, "explain": "why, one short ${langName} sentence" } ]
}

Give exactly 4 examples (easy → slightly harder) and exactly 5 exercises with 4 options each. Vary the position of the right answer. Every Korean sentence must be natural and correct.`,
  };
}

export function validateLesson(value: unknown): LessonPayload {
  const data = asObject(value, "answer");
  const title = str(data.title, 80);
  const explanation = str(data.explanation, 2000);
  if (!title || !explanation) throw new Error("lesson is incomplete");
  const examples = (Array.isArray(data.examples) ? data.examples : [])
    .map((raw) => {
      const e = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      return { ko: str(e.ko, 400), tr: str(e.tr, 400) };
    })
    .filter((e) => e.ko)
    .slice(0, 6);
  const exercises = (Array.isArray(data.exercises) ? data.exercises : [])
    .map((raw) => {
      const q = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const options = (Array.isArray(q.options) ? q.options : []).map((o) => str(o, 200)).filter(Boolean);
      const answer = Number(q.answer);
      if (!str(q.q) || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;
      return { q: str(q.q, 400), options, answer, explain: str(q.explain, 400) };
    })
    .filter((q): q is LessonExercise => q !== null)
    .slice(0, 6);
  if (examples.length < 2) throw new Error("lesson has no examples");
  return {
    title,
    meaning: str(data.meaning, 200),
    structure: str(data.structure, 500),
    explanation,
    compare: str(data.compare, 800),
    examples,
    mistake: str(data.mistake, 500),
    exercises,
  };
}

/* ------------------------------------------------------------------ help with a weak word */

export interface WordHelp {
  parts: string;
  hook: string;
  collocations: string[];
  confusedWith: Array<{ korean: string; meaning: string; difference: string }>;
  examples: LessonExample[];
}

export function wordHelpPrompt(input: { korean: string; meaning: string; level: Level; lang: TranslationLang }) {
  const langName = LANG_NAMES[input.lang];
  return {
    system: [
      "TASK: wordhelp",
      "You help a learner of Korean finally remember a word they keep forgetting.",
      `Learner level: ${LEVEL_GUIDE[input.level].label}.`,
      teacherVoice(input.lang),
    ].join("\n"),
    prompt: `Word: ${input.korean}
Meaning on the learner's card: ${input.meaning}

Return JSON:
{
  "parts": "how the word is built, if that helps: hanja roots with their meaning and one other common word that shares a root, or stem + ending. Empty string if there is nothing useful.",
  "hook": "one vivid, concrete memory hook in ${langName}: a sound-alike, an image or a tiny scene. 1-2 sentences.",
  "collocations": ["2-3 very common word pairs with this word, Korean + ${langName} in brackets"],
  "confusedWith": [ { "korean": "a word learners mix it up with", "meaning": "${langName}", "difference": "the difference in one short sentence" } ],
  "examples": [ { "ko": "short, simple 해요체 sentence", "tr": "${langName}" } ]
}

Give 3 examples that show the word in three different everyday situations. "confusedWith" has 0-2 entries: only real, common confusions.`,
  };
}

export function validateWordHelp(value: unknown): WordHelp {
  const data = asObject(value, "answer");
  const hook = str(data.hook, 600);
  const examples = (Array.isArray(data.examples) ? data.examples : [])
    .map((raw) => {
      const e = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      return { ko: str(e.ko, 400), tr: str(e.tr, 400) };
    })
    .filter((e) => e.ko)
    .slice(0, 4);
  if (!hook && !examples.length) throw new Error("empty answer");
  return {
    parts: str(data.parts, 600),
    hook,
    collocations: (Array.isArray(data.collocations) ? data.collocations : []).map((c) => str(c, 160)).filter(Boolean).slice(0, 4),
    confusedWith: (Array.isArray(data.confusedWith) ? data.confusedWith : [])
      .map((raw) => {
        const c = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
        return { korean: str(c.korean, 80), meaning: str(c.meaning, 160), difference: str(c.difference, 300) };
      })
      .filter((c) => c.korean)
      .slice(0, 2),
    examples,
  };
}

/* ------------------------------------------------------------------ chat */

export interface ChatMessage {
  role: "user" | "teacher";
  content: string;
}

export const CHAT_MAX_MESSAGES = 12;
export const CHAT_MAX_CHARS = 1500;

export function cleanChat(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const m = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const role = m.role === "teacher" ? "teacher" : "user";
      return { role, content: str(m.content, CHAT_MAX_CHARS) } as ChatMessage;
    })
    .filter((m) => m.content)
    .slice(-CHAT_MAX_MESSAGES);
}

export function chatPrompt(input: { messages: ChatMessage[]; level: Level; lang: TranslationLang; weakWords: string[] }) {
  const transcript = input.messages.map((m) => `${m.role === "user" ? "Student" : "Teacher"}: ${m.content}`).join("\n\n");
  return {
    system: [
      "TASK: chat",
      "You are the student's personal Korean teacher inside their vocabulary app. Answer questions about Korean words, grammar, sentences and how to study.",
      `Learner level: ${LEVEL_GUIDE[input.level].label}.`,
      teacherVoice(input.lang),
      "Keep answers short: usually under 120 words. Plain text only, no markdown symbols, no tables. Put each Korean example on its own line followed by its translation.",
      "If the student writes Korean with a mistake, show the corrected sentence first and explain the fix in one line. If asked to practise, give ONE small task at a time and wait for the answer.",
      "Stay on Korean learning. If the question is about something else, say so in one sentence.",
      input.weakWords.length ? `Words the student keeps forgetting (use them in examples when it fits): ${input.weakWords.slice(0, 15).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    prompt: `${transcript}\n\nTeacher:`,
  };
}

/* ------------------------------------------------------------------ weekly note */

export function weeklyNotePrompt(input: {
  lang: TranslationLang;
  score: number;
  total: number;
  activeDays: number;
  missed: Array<{ korean: string; meaning: string }>;
  planMessage: string;
}) {
  return {
    system: ["TASK: weeklynote", "You are the student's personal Korean teacher giving feedback after a weekly test.", teacherVoice(input.lang)].join("\n"),
    prompt: `Weekly test result: ${input.score} of ${input.total} right. Study days this week: ${input.activeDays} of 7.
Missed words: ${input.missed.map((w) => `${w.korean} (${w.meaning})`).join(", ") || "none"}
Plan decision for next week (already made, explain it kindly): ${input.planMessage}

Write 3-4 short sentences of plain text: an honest reaction to the result, one concrete tip for the missed words (name one or two of them), and what to do next week. No markdown, no greeting.`,
  };
}
