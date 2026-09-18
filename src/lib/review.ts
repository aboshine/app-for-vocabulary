import { endOfDay, isDue, startOfDay, type LearningState } from "./srs";

export interface QueueItem {
  id: string;
  nextReviewAt: Date;
}

export function filterDueQueue<T extends QueueItem>(items: T[], now: Date): T[] {
  return items
    .filter((item) => isDue(item.nextReviewAt, now))
    .sort((a, b) => a.nextReviewAt.getTime() - b.nextReviewAt.getTime());
}

export interface StatsInput {
  learningState: LearningState;
  nextReviewAt: Date;
}

export interface DashboardStats {
  total: number;
  new: number;
  learning: number;
  learned: number;
  dueToday: number;
  reviewsToday: number;
}

export function computeDashboardStats(
  words: StatsInput[],
  reviewsToday: number,
  now: Date = new Date(),
): DashboardStats {
  const dueLimit = endOfDay(now);
  return {
    total: words.length,
    new: words.filter((w) => w.learningState === "new").length,
    learning: words.filter((w) => w.learningState === "learning").length,
    learned: words.filter((w) => w.learningState === "learned").length,
    dueToday: words.filter((w) => w.nextReviewAt.getTime() <= dueLimit.getTime()).length,
    reviewsToday,
  };
}

export function isToday(date: Date, now: Date = new Date()): boolean {
  return date.getTime() >= startOfDay(now).getTime() && date.getTime() <= endOfDay(now).getTime();
}
