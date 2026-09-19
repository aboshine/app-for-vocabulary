import type { Rating, ReviewDirection } from "./srs";

export type ReviewMode = ReviewDirection;
export type ModeFilter =
  | "mixed"
  | "ko-meaning"
  | "meaning-ko"
  | "sentence"
  | "sentence-production"
  | "typing";
export type TypedReviewMode = "typing" | "sentence-production";

export const MODE_FILTERS: ModeFilter[] = [
  "mixed",
  "ko-meaning",
  "meaning-ko",
  "sentence",
  "sentence-production",
  "typing",
];

export const MIXED_ROTATION: ReviewMode[] = [
  "ko-meaning",
  "meaning-ko",
  "sentence-meaning",
  "sentence-completion",
  "sentence-production",
  "typing",
];

export interface ReviewWord {
  id: string;
  korean: string;
  meaning: string;
  exampleSentence: string;
  exampleTranslation: string;
  notes: string;
}

export interface PromptContent {
  mode: ReviewMode;
  prompt: string;
  hint: string;
  answer: string;
  extras: string[];
  translationHint?: string;
  originalSentence?: string;
}

export function hasSentence(word: Pick<ReviewWord, "exampleSentence">): boolean {
  return word.exampleSentence.trim().length > 0;
}

export function isTypedReviewMode(mode: ReviewMode): mode is TypedReviewMode {
  return mode === "typing" || mode === "sentence-production";
}

export function mixedRotation(enabled?: ReviewMode[]): ReviewMode[] {
  if (!enabled?.length) return [...MIXED_ROTATION];
  const selected = MIXED_ROTATION.filter((mode) => enabled.includes(mode));
  return selected.length ? selected : [...MIXED_ROTATION];
}

export function availableModes(word: ReviewWord, filter: ModeFilter, enabledMixed?: ReviewMode[]): ReviewMode[] {
  if (filter === "ko-meaning") return ["ko-meaning"];
  if (filter === "meaning-ko") return ["meaning-ko"];
  if (filter === "typing") return ["typing"];
  if (filter === "sentence-production") {
    return hasSentence(word) ? ["sentence-production"] : ["ko-meaning"];
  }
  if (filter === "sentence") {
    return hasSentence(word) ? ["sentence-meaning", "sentence-completion"] : ["ko-meaning"];
  }
  const mixed: ReviewMode[] = ["ko-meaning", "meaning-ko", "typing"];
  if (hasSentence(word)) {
    mixed.splice(2, 0, "sentence-meaning", "sentence-completion", "sentence-production");
  }
  if (!enabledMixed?.length) return mixed;
  const allowed = mixedRotation(enabledMixed);
  const filtered = mixed.filter((mode) => allowed.includes(mode));
  return filtered.length ? filtered : mixed;
}

export function pickReviewMode(word: ReviewWord, filter: ModeFilter, index: number, enabledMixed?: ReviewMode[]): ReviewMode {
  const modes = availableModes(word, filter, enabledMixed);
  return modes[Math.abs(index) % modes.length];
}

export function assignQueueModes<T extends ReviewWord>(
  queue: T[],
  filter: ModeFilter,
  enabledMixed?: ReviewMode[],
): Array<T & { mode: ReviewMode }> {
  if (filter !== "mixed") {
    return queue.map((word, index) => ({ ...word, mode: pickReviewMode(word, filter, index) }));
  }
  const rotation = mixedRotation(enabledMixed);
  let cursor = 0;
  return queue.map((word) => {
    const supported = availableModes(word, "mixed", enabledMixed);
    for (let offset = 0; offset < rotation.length; offset += 1) {
      const candidate = rotation[(cursor + offset) % rotation.length];
      if (supported.includes(candidate)) {
        cursor = cursor + offset + 1;
        return { ...word, mode: candidate };
      }
    }
    return { ...word, mode: supported[0] };
  });
}

export function blankTargetWord(sentence: string, korean: string): string {
  const source = sentence.normalize("NFC");
  const target = korean.normalize("NFC").trim();
  if (!target) return source;
  const index = source.indexOf(target);
  if (index === -1) return `_____ ${source}`.trim();
  return `${source.slice(0, index)}_____${source.slice(index + target.length)}`;
}

export function buildPrompt(word: ReviewWord, mode: ReviewMode): PromptContent {
  switch (mode) {
    case "ko-meaning":
      return {
        mode,
        prompt: word.korean,
        hint: "Recall the meaning",
        answer: word.meaning,
        extras: extras(word, ["exampleSentence", "exampleTranslation", "notes"]),
      };
    case "meaning-ko":
      return {
        mode,
        prompt: word.meaning,
        hint: "Recall the Korean",
        answer: word.korean,
        extras: extras(word, ["exampleSentence", "exampleTranslation", "notes"]),
      };
    case "sentence-meaning":
      return {
        mode,
        prompt: word.exampleSentence,
        hint: "What does this sentence mean?",
        answer: word.exampleTranslation || word.meaning,
        extras: extras(word, ["meaning", "notes"]),
      };
    case "sentence-completion":
      return {
        mode,
        prompt: blankTargetWord(word.exampleSentence, word.korean),
        hint: "Complete the sentence",
        answer: word.exampleSentence,
        extras: extras(word, ["korean", "meaning", "exampleTranslation"]),
      };
    case "sentence-production":
      return {
        mode,
        prompt: blankTargetWord(word.exampleSentence, word.korean),
        hint: "Type the missing word",
        answer: word.korean,
        extras: extras(word, ["meaning", "notes"]),
        translationHint: word.exampleTranslation.trim() || undefined,
        originalSentence: word.exampleSentence,
      };
    case "typing":
      return {
        mode,
        prompt: word.meaning,
        hint: "Type the Korean",
        answer: word.korean,
        extras: extras(word, ["exampleSentence", "exampleTranslation", "notes"]),
      };
  }
}

export function sentenceProductionPrompt(word: ReviewWord): PromptContent | null {
  if (!hasSentence(word)) return null;
  return buildPrompt(word, "sentence-production");
}

export function normalizeReviewAnswer(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function isTypingAnswerCorrect(typed: string, expected: string): boolean {
  return normalizeReviewAnswer(typed) === normalizeReviewAnswer(expected);
}

export function typedReviewPayload<T extends TypedReviewMode>(
  vocabularyId: string,
  rating: Rating,
  direction: T,
): { vocabularyId: string; rating: Rating; direction: T } {
  return { vocabularyId, rating, direction };
}

export function typingReviewPayload(
  vocabularyId: string,
  rating: Rating,
): { vocabularyId: string; rating: Rating; direction: "typing" } {
  return typedReviewPayload(vocabularyId, rating, "typing");
}

function extras(word: ReviewWord, keys: Array<keyof ReviewWord>): string[] {
  return keys
    .map((key) => word[key])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}
