import { isTypingAnswerCorrect } from "./review-modes";
import type { Adjustment } from "./plan";

/**
 * Weekly check (pure part): a short test built from the words studied in the last
 * week plus a few older "learned" ones, to see what really stuck.
 */

export const WEEKLY_INTERVAL_DAYS = 7;
export const WEEKLY_MIN_STUDIED = 8;

export type WeeklyKind = "ko-choice" | "meaning-choice" | "typing" | "grammar";

export interface WeeklyQuestion {
  /** "" for grammar questions */
  vocabularyId: string;
  /** Grammar card id, for grammar questions only */
  grammarId?: string;
  kind: WeeklyKind;
  /** what is shown */
  prompt: string;
  /** options for choice questions */
  options: string[];
  /** correct answer text (kept on the server until the check is graded) */
  answer: string;
}

export interface WeeklyWord {
  id: string;
  korean: string;
  meaning: string;
  learningState: string;
  reviewCount: number;
  againCount: number;
  hardCount: number;
  lastReviewedAt: Date | null;
  createdAt: Date;
}

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function questionCount(minutes: number): number {
  return minutes >= 40 ? 20 : minutes >= 25 ? 16 : 12;
}

/** Words to test: this week's words (hardest first), then older learned words as a memory probe. */
export function pickWeeklyWords(words: WeeklyWord[], count: number, now: Date, rng: Rng = Math.random): WeeklyWord[] {
  const weekAgo = now.getTime() - WEEKLY_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
  const studied = words.filter((w) => w.reviewCount > 0);
  const difficulty = (w: WeeklyWord) => (w.againCount * 2 + w.hardCount) / Math.max(1, w.reviewCount);
  const recent = shuffle(
    studied.filter((w) => (w.lastReviewedAt?.getTime() ?? 0) >= weekAgo),
    rng,
  ).sort((a, b) => difficulty(b) - difficulty(a));
  const older = shuffle(
    studied.filter((w) => (w.lastReviewedAt?.getTime() ?? 0) < weekAgo),
    rng,
  );
  const probe = Math.min(older.length, Math.max(2, Math.round(count * 0.25)));
  // Half of the "recent" slots go to the hardest words, the rest are a random sample.
  const recentSlots = count - probe;
  const hardest = recent.slice(0, Math.ceil(recentSlots / 2));
  const rest = shuffle(recent.slice(hardest.length), rng).slice(0, recentSlots - hardest.length);
  const chosen = [...hardest, ...rest, ...older.slice(0, probe)];
  // Top up from whatever is left if the week was thin.
  if (chosen.length < count) {
    const taken = new Set(chosen.map((w) => w.id));
    for (const w of [...recent, ...older]) {
      if (chosen.length >= count) break;
      if (!taken.has(w.id)) chosen.push(w);
    }
  }
  return shuffle(chosen.slice(0, count), rng);
}

function distractors(pool: string[], correct: string, n: number, rng: Rng): string[] {
  const unique = [...new Set(pool.filter((x) => x && x !== correct))];
  return shuffle(unique, rng).slice(0, n);
}

export function buildWeeklyQuestions(chosen: WeeklyWord[], deck: WeeklyWord[], rng: Rng = Math.random): WeeklyQuestion[] {
  const meanings = deck.map((w) => w.meaning);
  const koreans = deck.map((w) => w.korean);
  const kinds: WeeklyKind[] = ["ko-choice", "meaning-choice", "ko-choice", "typing"];
  return chosen.map((word, index) => {
    let kind = kinds[index % kinds.length];
    const meaningOptions = distractors(meanings, word.meaning, 3, rng);
    const koreanOptions = distractors(koreans, word.korean, 3, rng);
    // Not enough other cards for a fair choice question: fall back to typing.
    if (kind === "ko-choice" && meaningOptions.length < 3) kind = "typing";
    if (kind === "meaning-choice" && koreanOptions.length < 3) kind = "typing";
    if (kind === "ko-choice") {
      return { vocabularyId: word.id, kind, prompt: word.korean, options: shuffle([word.meaning, ...meaningOptions], rng), answer: word.meaning };
    }
    if (kind === "meaning-choice") {
      return { vocabularyId: word.id, kind, prompt: word.meaning, options: shuffle([word.korean, ...koreanOptions], rng), answer: word.korean };
    }
    return { vocabularyId: word.id, kind, prompt: word.meaning, options: [], answer: word.korean };
  });
}

export interface WeeklyResultRow {
  vocabularyId: string;
  grammarId?: string;
  kind: WeeklyKind;
  prompt: string;
  answer: string;
  given: string;
  correct: boolean;
}

export function gradeWeekly(questions: WeeklyQuestion[], answers: string[]): WeeklyResultRow[] {
  return questions.map((q, i) => {
    const given = String(answers[i] ?? "").trim();
    const correct = q.kind === "typing" ? isTypingAnswerCorrect(given, q.answer) : given === q.answer;
    return { vocabularyId: q.vocabularyId, ...(q.grammarId ? { grammarId: q.grammarId } : {}), kind: q.kind, prompt: q.prompt, answer: q.answer, given, correct };
  });
}

export interface WeeklySummary {
  rows: WeeklyResultRow[];
  accuracy: number;
  activeDays: number;
  adjustment: Adjustment;
  /** short note from the AI teacher ("" when AI is off or failed) */
  comment: string;
}

export const WEEKLY_GRAMMAR_QUESTIONS = 3;

export interface FinishedLesson {
  grammarId: string;
  exercises: Array<{ q: string; options: string[]; answer: number }>;
}

/** Up to 3 grammar questions, one exercise from each of a few finished lessons. */
export function buildGrammarQuestions(lessons: FinishedLesson[], rng: Rng = Math.random, max = WEEKLY_GRAMMAR_QUESTIONS): WeeklyQuestion[] {
  const usable = lessons.filter((l) => l.grammarId && l.exercises.some((e) => e.options[e.answer] !== undefined));
  return shuffle(usable, rng)
    .slice(0, max)
    .map((lesson) => {
      const exercise = shuffle(lesson.exercises.filter((e) => e.options[e.answer] !== undefined), rng)[0];
      return {
        vocabularyId: "",
        grammarId: lesson.grammarId,
        kind: "grammar" as const,
        prompt: exercise.q,
        options: shuffle(exercise.options, rng),
        answer: exercise.options[exercise.answer],
      };
    });
}

/** Hide the answers before sending questions to the browser. */
export function publicQuestions(questions: WeeklyQuestion[]) {
  return questions.map(({ kind, prompt, options }) => ({ kind, prompt, options }));
}

export function weeklyIsDue(input: { lastCompletedAt: Date | null; studiedWords: number; firstReviewAt: Date | null; now: Date }): boolean {
  if (input.studiedWords < WEEKLY_MIN_STUDIED) return false;
  const since = input.lastCompletedAt ?? input.firstReviewAt;
  if (!since) return false;
  return input.now.getTime() - since.getTime() >= WEEKLY_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}
