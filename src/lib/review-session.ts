import { assignQueueModes, type ModeFilter, type ReviewMode, type ReviewWord } from "./review-modes";
import { endOfDay, isDue, startOfDay, type LearningState } from "./srs";

export const SESSION_LIMITS = [10, 20, 30, "all"] as const;
export type SessionLimit = (typeof SESSION_LIMITS)[number];

/** SRS fields shared by vocabulary and grammar review queues. */
export interface SessionSrsFields {
  id: string;
  categoryId: string | null;
  learningState: LearningState;
  nextReviewAt: Date;
  reviewCount: number;
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
}

export interface SessionCard extends ReviewWord, SessionSrsFields {}

export interface SessionConfig {
  limit: SessionLimit;
  mode: ModeFilter;
  categoryId: string;
  includeNew: boolean;
}

export const TODAY_SESSION: SessionConfig = {
  limit: "all",
  mode: "mixed",
  categoryId: "",
  includeNew: true,
};

export interface SessionPreview {
  due: number;
  overdue: number;
  new: number;
  estimated: number;
}

export function difficultyScore(card: Pick<SessionCard, "againCount" | "hardCount" | "reviewCount">): number {
  if (card.reviewCount <= 0) return 0;
  return (card.againCount * 2 + card.hardCount) / card.reviewCount;
}

export function isOverdue(nextReviewAt: Date, now: Date): boolean {
  return nextReviewAt.getTime() < startOfDay(now).getTime();
}

export function isDueToday(nextReviewAt: Date, now: Date): boolean {
  const time = nextReviewAt.getTime();
  return time >= startOfDay(now).getTime() && time <= endOfDay(now).getTime();
}

export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

export type QueueConfig = Pick<SessionConfig, "limit" | "categoryId" | "includeNew"> &
  Partial<Pick<SessionConfig, "mode">>;

function matchesCategory(card: Pick<SessionSrsFields, "categoryId">, categoryId: string): boolean {
  return !categoryId || card.categoryId === categoryId;
}

function eligibleCards<T extends SessionSrsFields>(cards: T[], config: QueueConfig, now: Date): T[] {
  return uniqueById(
    cards.filter((card) => {
      if (!matchesCategory(card, config.categoryId)) return false;
      const isNew = card.learningState === "new";
      if (!config.includeNew && isNew) return false;
      if (isOverdue(card.nextReviewAt, now) || isDueToday(card.nextReviewAt, now)) return true;
      if (config.includeNew && isNew) return true;
      return isDue(card.nextReviewAt, now);
    }),
  );
}

function byTimeThenDifficulty<T extends SessionSrsFields>(a: T, b: T): number {
  const diff = difficultyScore(b) - difficultyScore(a);
  if (diff !== 0) return diff;
  const time = a.nextReviewAt.getTime() - b.nextReviewAt.getTime();
  if (time !== 0) return time;
  return a.id.localeCompare(b.id);
}

export function sessionPriority(card: SessionSrsFields, now: Date): 1 | 2 | 3 | 4 {
  if (card.learningState === "new") return 4;
  if (isOverdue(card.nextReviewAt, now)) return 1;
  const hard = card.reviewCount > 0 && difficultyScore(card) >= 0.5;
  if (hard) return 3;
  if (isDueToday(card.nextReviewAt, now) || isDue(card.nextReviewAt, now)) return 2;
  return 4;
}

export function buildSessionQueue<T extends SessionSrsFields>(
  cards: T[],
  config: QueueConfig,
  now: Date,
): T[] {
  const pool = eligibleCards(cards, config, now);
  const overdue = pool
    .filter((card) => sessionPriority(card, now) === 1)
    .sort(byTimeThenDifficulty);
  const dueToday = pool
    .filter((card) => sessionPriority(card, now) === 2)
    .sort(byTimeThenDifficulty);
  const difficult = pool
    .filter((card) => sessionPriority(card, now) === 3)
    .sort(byTimeThenDifficulty);
  const fresh = pool
    .filter((card) => sessionPriority(card, now) === 4)
    .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime() || a.id.localeCompare(b.id));

  const ordered = uniqueById([...overdue, ...dueToday, ...difficult, ...fresh]);
  if (config.limit === "all") return ordered;
  return ordered.slice(0, config.limit);
}

export function previewSession<T extends SessionSrsFields>(
  cards: T[],
  config: QueueConfig,
  now: Date,
): SessionPreview {
  const inCategory = cards.filter((card) => matchesCategory(card, config.categoryId));
  const queue = buildSessionQueue(cards, config, now);
  return {
    overdue: inCategory.filter((card) => isOverdue(card.nextReviewAt, now)).length,
    due: inCategory.filter((card) => isDueToday(card.nextReviewAt, now)).length,
    new: inCategory.filter((card) => card.learningState === "new").length,
    estimated: queue.length,
  };
}

export function startSession(
  cards: SessionCard[],
  config: SessionConfig,
  now: Date,
): Array<SessionCard & { mode: ReviewMode }> {
  return assignQueueModes(buildSessionQueue(cards, config, now), config.mode);
}
