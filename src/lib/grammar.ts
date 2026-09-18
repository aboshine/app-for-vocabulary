import { scheduleReview, type LearningState, type Rating } from "./srs";
import { parseLearningState, type GrammarExample } from "./validation";
import { wordDetailStats, type WordDetailStats } from "./vocab-detail";

export interface GrammarRecord {
  id: string;
  title: string;
  meaning: string;
  explanation: string;
  structure: string;
  examples: GrammarExample[];
  notes: string;
  categoryId: string | null;
  tags: string;
  learningState: LearningState;
  reviewCount: number;
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
  nextReviewAt: Date;
  lastReviewedAt: Date | null;
  intervalMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GrammarFilters {
  q?: string;
  categoryId?: string;
  state?: string;
}

export interface GrammarReviewHistoryEntry {
  rating: Rating;
  intervalBefore: number;
  intervalAfter: number;
  createdAt: Date;
}

export interface AppliedGrammarReview {
  intervalMinutes: number;
  nextReviewAt: Date;
  learningState: LearningState;
  lastReviewedAt: Date;
  reviewCount: number;
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
  historyEntry: GrammarReviewHistoryEntry;
}

export function createGrammarRecord(
  input: {
    title: string;
    meaning: string;
    explanation: string;
    structure: string;
    examples: GrammarExample[];
    notes: string;
    categoryId: string | null;
    tags: string;
  },
  now = new Date(),
  id = "grammar-new",
): GrammarRecord {
  return {
    id,
    ...input,
    learningState: "new",
    reviewCount: 0,
    againCount: 0,
    hardCount: 0,
    goodCount: 0,
    easyCount: 0,
    nextReviewAt: now,
    lastReviewedAt: null,
    intervalMinutes: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateGrammarRecord(
  current: GrammarRecord,
  input: {
    title: string;
    meaning: string;
    explanation: string;
    structure: string;
    examples: GrammarExample[];
    notes: string;
    categoryId: string | null;
    tags: string;
  },
  now = new Date(),
): GrammarRecord {
  return { ...current, ...input, updatedAt: now };
}

export function deleteGrammarById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

export function filterGrammarRecords<T extends {
  title: string;
  meaning: string;
  explanation: string;
  structure: string;
  tags: string;
  categoryId: string | null;
  learningState: string;
}>(items: T[], filters: GrammarFilters): T[] {
  const state = parseLearningState(filters.state ?? null);
  const q = filters.q?.trim().toLowerCase() ?? "";
  return items.filter((item) => {
    if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
    if (state && item.learningState !== state) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.meaning.toLowerCase().includes(q) ||
      item.explanation.toLowerCase().includes(q) ||
      item.structure.toLowerCase().includes(q) ||
      item.tags.toLowerCase().includes(q)
    );
  });
}

export function applyGrammarReview(
  card: Pick<
    GrammarRecord,
    | "intervalMinutes"
    | "learningState"
    | "reviewCount"
    | "againCount"
    | "hardCount"
    | "goodCount"
    | "easyCount"
  >,
  rating: Rating,
  now = new Date(),
): AppliedGrammarReview {
  const scheduled = scheduleReview(
    { intervalMinutes: card.intervalMinutes, learningState: card.learningState },
    rating,
    now,
  );
  const counts = {
    againCount: card.againCount,
    hardCount: card.hardCount,
    goodCount: card.goodCount,
    easyCount: card.easyCount,
  };
  if (rating === "again") counts.againCount += 1;
  if (rating === "hard") counts.hardCount += 1;
  if (rating === "good") counts.goodCount += 1;
  if (rating === "easy") counts.easyCount += 1;
  return {
    intervalMinutes: scheduled.intervalMinutes,
    nextReviewAt: scheduled.nextReviewAt,
    learningState: scheduled.learningState,
    lastReviewedAt: now,
    reviewCount: card.reviewCount + 1,
    ...counts,
    historyEntry: {
      rating,
      intervalBefore: card.intervalMinutes,
      intervalAfter: scheduled.intervalMinutes,
      createdAt: now,
    },
  };
}

export function grammarReviewStats(
  card: Pick<GrammarRecord, "reviewCount" | "againCount" | "hardCount" | "goodCount" | "easyCount">,
): WordDetailStats {
  return wordDetailStats(card);
}

export function appendReviewHistory<T extends GrammarReviewHistoryEntry>(
  history: T[],
  entry: T,
): T[] {
  return [entry, ...history];
}
